import { NextRequest, NextResponse } from "next/server";
import { ActivityAction } from "@prisma/client";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { redirectToStorageObject } from "@/lib/storage-delivery";
import { extractStoragePathFromUrl } from "@/lib/storage-path";
import archiver from "archiver";
import { PassThrough, Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import {
  getPublicShareAccessCookieName,
  isValidPublicShareAccessCookie,
} from "@/lib/public-share-access";
import { isRateLimited, bumpRateLimit } from "@/lib/rate-limit";
import {
  migratePublicShareToken,
  resolvePublicShareByToken,
} from "@/lib/public-share-service";
import {
  buildChildrenMap,
  buildFolderPathMap,
  collectDescendants,
  isDescendantFolder,
} from "@/lib/folder-tree";

export const runtime = "nodejs";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> | { token: string } },
) {
  const { token } = await Promise.resolve(params);

    const resolvedShare = await resolvePublicShareByToken(token);

    if (resolvedShare?.kind === "file") {
      const { share: resolvedFileShare, isLegacy, tokenHash } = resolvedShare;
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

    if (isLegacy) {
      try {
        await migratePublicShareToken("file", resolvedFileShare.id, tokenHash);
      } catch {
        // ignore migration errors
      }
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ message: "Server storage config missing" }, { status: 500 });
    }

    await db.activity.create({
      data: {
        userId: resolvedFileShare.userId,
        action: ActivityAction.DOWNLOAD,
        fileId: resolvedFileShare.file.id,
        metadata: {
          shareId: resolvedFileShare.id,
          fileId: resolvedFileShare.file.id,
          fileName: resolvedFileShare.file.fileName,
          shareToken: token,
          viewerIp: getClientIp(request),
          viewerAgent: request.headers.get("user-agent"),
        },
      },
    });

    return redirectToStorageObject({
      fileUrl: resolvedFileShare.file.fileUrl,
      fileName: resolvedFileShare.file.fileName,
      download: true,
    });
  }

  if (resolvedShare?.kind !== "folder") {
    return NextResponse.json({ message: `Share not found for token ${token}` }, { status: 404 });
  }

  const { share: folderShare, isLegacy, tokenHash } = resolvedShare;

  if (!folderShare.folder || folderShare.folder.isDeleted || folderShare.folder.isTrashed) {
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

  if (isLegacy) {
    try {
      await migratePublicShareToken("folder", folderShare.id, tokenHash);
    } catch {
      // ignore migration errors
    }
  }

  const fileId = request.nextUrl.searchParams.get("fileId");
  const zipRequested = request.nextUrl.searchParams.get("zip") === "1";
  if (!fileId) {
    if (!zipRequested) {
      return NextResponse.redirect(new URL(`/s/${token}`, request.url));
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ message: "Server storage config missing" }, { status: 500 });
    }

    const allFolders = await db.folder.findMany({
      where: {
        userId: folderShare.folder.userId,
        isDeleted: false,
        isTrashed: false,
      },
      select: { id: true, parentId: true, name: true },
    });

    const childrenMap = buildChildrenMap(allFolders);
    const folderIds = new Set(collectDescendants(folderShare.folder.id, childrenMap));

    const files = await db.file.findMany({
      where: {
        userId: folderShare.folder.userId,
        isDeleted: false,
        isTrashed: false,
        folderId: { in: Array.from(folderIds) },
      },
      select: { id: true, fileName: true, fileUrl: true, folderId: true },
      orderBy: { fileName: "asc" },
    });

    const folderPathMap = buildFolderPathMap(allFolders, folderShare.folder.id);
    const zipStream = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (error) => {
      zipStream.destroy(error);
    });

    archive.pipe(zipStream);

    const zipTask = (async () => {
      for (const file of files) {
        const storagePath = extractStoragePathFromUrl(file.fileUrl);
        if (!storagePath) continue;

        const signed = await supabaseAdmin.storage
          .from("files")
          .createSignedUrl(storagePath, 60 * 5);
        const signedUrl = signed?.data?.signedUrl;
        if (!signedUrl) continue;

        const response = await fetch(signedUrl);
        if (!response.ok || !response.body) continue;

        const nodeStream = Readable.fromWeb(response.body as NodeReadableStream);
        const folderPath = file.folderId ? folderPathMap.get(file.folderId) : folderShare.folder?.name ?? undefined;
        const entryName = folderPath ? `${folderPath}/${file.fileName}` : file.fileName;
        archive.append(nodeStream, { name: entryName });
      }

      await archive.finalize();
    })();

    zipTask.catch((error) => {
      zipStream.destroy(error);
    });

    await db.activity.create({
      data: {
        userId: folderShare.userId,
        action: ActivityAction.DOWNLOAD,
        fileId: null,
        metadata: {
          shareId: folderShare.id,
          folderId: folderShare.folder.id,
          folderName: folderShare.folder.name,
          shareToken: token,
          fileCount: files.length,
          zip: true,
          viewerIp: getClientIp(request),
          viewerAgent: request.headers.get("user-agent"),
        },
      },
    });

    const zipName = `${folderShare.folder.name || "shared-folder"}.zip`;
    return new NextResponse(Readable.toWeb(zipStream) as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
        "Cache-Control": "private, no-store",
      },
    });
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

  await db.activity.create({
    data: {
      userId: folderShare.userId,
      action: ActivityAction.DOWNLOAD,
      fileId: file.id,
      metadata: {
        shareId: folderShare.id,
        folderId: folderShare.folder.id,
        fileId: file.id,
        fileName: file.fileName,
        shareToken: token,
        viewerIp: getClientIp(request),
        viewerAgent: request.headers.get("user-agent"),
      },
    },
  });

  return redirectToStorageObject({
    fileUrl: file.fileUrl,
    fileName: file.fileName,
    download: true,
  });
}
