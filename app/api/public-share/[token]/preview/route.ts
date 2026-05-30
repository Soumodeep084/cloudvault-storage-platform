import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";
import {
  getPublicShareAccessCookieName,
  isValidPublicShareAccessCookie,
} from "@/lib/public-share-access";
import { hashShareToken } from "@/lib/token-utils";
import { isRateLimited, bumpRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function buildContentDisposition(fileName: string) {
  const encodedName = encodeURIComponent(fileName);
  return `inline; filename*=UTF-8''${encodedName}`;
}

function isDescendantFolder(
  folderId: string | null,
  rootId: string,
  parentMap: Map<string, string | null>,
) {
  let current = folderId;
  const visited = new Set<string>();

  while (current) {
    if (current === rootId) return true;
    if (visited.has(current)) break;
    visited.add(current);
    current = parentMap.get(current) ?? null;
  }

  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> | { token: string } },
) {
  const { token } = await Promise.resolve(params);

  const tokenHash = hashShareToken(token);
  const fileShare = await db.share.findFirst({
    where: {
      token: tokenHash,
      isPublic: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      file: {
        select: {
          id: true,
          userId: true,
          fileName: true,
          fileUrl: true,
          fileType: true,
          isDeleted: true,
          isTrashed: true,
        },
      },
    },
  });
  let fileShareIsLegacy = false;
  let resolvedFileShare = fileShare;
  if (!resolvedFileShare) {
    // Fallback: check for legacy plaintext token and mark for migration
    const legacy = await db.share.findFirst({
      where: {
        token,
        isPublic: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        file: {
          select: {
            id: true,
            userId: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            isDeleted: true,
            isTrashed: true,
          },
        },
      },
    });

    if (legacy) {
      resolvedFileShare = legacy;
      fileShareIsLegacy = true;
    }
  }

  if (resolvedFileShare) {
    const rlKey = `share:${resolvedFileShare.id}`;
    if (isRateLimited(rlKey).limited) {
      return NextResponse.json({ message: "Too many attempts" }, { status: 429 });
    }
    if (!resolvedFileShare.file || resolvedFileShare.file.isDeleted) {
      return NextResponse.json({ message: `File missing or deleted for file share ${resolvedFileShare.id}` }, { status: 404 });
    }

    if (resolvedFileShare.password) {
      const accessCookie = request.cookies.get(getPublicShareAccessCookieName(resolvedFileShare.id))?.value;
      if (!isValidPublicShareAccessCookie(resolvedFileShare.id, accessCookie)) {
        bumpRateLimit(rlKey);
        return NextResponse.redirect(new URL(`/s/${token}?error=auth-required`, request.url));
      }
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ message: "Server storage config missing" }, { status: 500 });
    }

    // Migrate legacy plaintext token to hashed token after successful access
    if (fileShareIsLegacy) {
      try {
        await db.share.update({ where: { id: resolvedFileShare.id }, data: { token: tokenHash } });
      } catch {
        // ignore migration errors (unique constraint, race conditions)
      }
    }

    const storagePath = extractStoragePathFromUrl(resolvedFileShare.file.fileUrl);
    if (!storagePath) {
      return NextResponse.json({ message: "Invalid storage path" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from("files")
      .download(storagePath);

    if (error || !data) {
      return NextResponse.json({ message: "Unable to fetch file" }, { status: 500 });
    }

    const fileBuffer = Buffer.from(await data.arrayBuffer());
    const contentType = resolvedFileShare.file.fileType || data.type || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": buildContentDisposition(resolvedFileShare.file.fileName),
        "Cache-Control": "private, max-age=60",
      },
    });
  }


  let folderShareIsLegacy = false;
  let folderShare = await db.folderShare.findFirst({
    where: {
      token: tokenHash,
      isPublic: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      folder: {
        select: {
          id: true,
          userId: true,
          name: true,
          isDeleted: true,
          isTrashed: true,
        },
      },
    },
  });

  if (!folderShare) {
    const legacyFolder = await db.folderShare.findFirst({
      where: {
        token,
        isPublic: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        folder: {
          select: {
            id: true,
            userId: true,
            name: true,
            isDeleted: true,
            isTrashed: true,
          },
        },
      },
    });
    if (legacyFolder) {
      folderShare = legacyFolder;
      folderShareIsLegacy = true;
    }
  }

  if (!folderShare || !folderShare.folder || folderShare.folder.isDeleted || folderShare.folder.isTrashed) {
    return NextResponse.json({ message: `Share not found for token ${token}` }, { status: 404 });
  }

  if (folderShare.password) {
    const rlKey = `share:${folderShare.id}`;
    if (isRateLimited(rlKey).limited) {
      return NextResponse.json({ message: "Too many attempts" }, { status: 429 });
    }
    const accessCookie = request.cookies.get(getPublicShareAccessCookieName(folderShare.id))?.value;
    if (!isValidPublicShareAccessCookie(folderShare.id, accessCookie)) {
      bumpRateLimit(rlKey);
      return NextResponse.redirect(new URL(`/s/${token}?error=auth-required`, request.url));
    }
  }

  // Migrate legacy folder share token if access is allowed
  if (folderShareIsLegacy) {
    try {
      await db.folderShare.update({ where: { id: folderShare.id }, data: { token: tokenHash } });
    } catch {
      // ignore migration errors
    }
  }

  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.redirect(new URL(`/s/${token}`, request.url));
  }

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId: folderShare.folder.userId,
      isDeleted: false,
      isTrashed: false,
    },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      fileType: true,
      folderId: true,
    },
  });

  if (!file) {
    return NextResponse.json({ message: `File ${fileId} not found for folder share ${folderShare.id}` }, { status: 404 });
  }

  const folderRows = await db.folder.findMany({
    where: { userId: folderShare.folder.userId, isDeleted: false, isTrashed: false },
    select: { id: true, parentId: true },
  });
  const parentMap = new Map(folderRows.map((row) => [row.id, row.parentId]));

  if (!isDescendantFolder(file.folderId ?? null, folderShare.folder.id, parentMap)) {
    return NextResponse.json({ message: `File ${fileId} is not a descendant of shared folder ${folderShare.folder.id}` }, { status: 404 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ message: "Server storage config missing" }, { status: 500 });
  }

  const storagePath = extractStoragePathFromUrl(file.fileUrl);
  if (!storagePath) {
    return NextResponse.json({ message: "Invalid storage path" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from("files")
    .download(storagePath);

  if (error || !data) {
    return NextResponse.json({ message: "Unable to fetch file" }, { status: 500 });
  }

  const fileBuffer = Buffer.from(await data.arrayBuffer());
  const contentType = file.fileType || data.type || "application/octet-stream";

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": buildContentDisposition(file.fileName),
      "Cache-Control": "private, max-age=60",
    },
  });
}
