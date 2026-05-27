import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";
import {
  getPublicShareAccessCookieName,
  isValidPublicShareAccessCookie,
} from "@/lib/public-share-access";

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

  const fileShare = await db.share.findFirst({
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

  if (fileShare) {
    if (!fileShare.file || fileShare.file.isDeleted) {
      return NextResponse.json({ message: `File missing or deleted for file share ${fileShare.id}` }, { status: 404 });
    }

    if (fileShare.password) {
      const accessCookie = request.cookies.get(getPublicShareAccessCookieName(fileShare.id))?.value;
      if (!isValidPublicShareAccessCookie(fileShare.id, accessCookie)) {
        return NextResponse.redirect(new URL(`/s/${token}?error=auth-required`, request.url));
      }
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ message: "Server storage config missing" }, { status: 500 });
    }

    const storagePath = extractStoragePathFromUrl(fileShare.file.fileUrl);
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
    const contentType = fileShare.file.fileType || data.type || "application/octet-stream";

      return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": buildContentDisposition(fileShare.file.fileName),
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  const folderShare = await db.folderShare.findFirst({
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

  if (!folderShare || !folderShare.folder || folderShare.folder.isDeleted || folderShare.folder.isTrashed) {
    return NextResponse.json({ message: `Share not found for token ${token}` }, { status: 404 });
  }

  if (folderShare.password) {
    const accessCookie = request.cookies.get(getPublicShareAccessCookieName(folderShare.id))?.value;
    if (!isValidPublicShareAccessCookie(folderShare.id, accessCookie)) {
      return NextResponse.redirect(new URL(`/s/${token}?error=auth-required`, request.url));
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
