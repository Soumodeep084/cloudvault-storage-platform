import { NextRequest, NextResponse } from "next/server";
import { ActivityAction } from "@prisma/client";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";
import archiver from "archiver";
import { PassThrough, Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import {
  getPublicShareAccessCookieName,
  isValidPublicShareAccessCookie,
} from "@/lib/public-share-access";

export const runtime = "nodejs";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || null;
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

function buildChildrenMap(folders: Array<{ id: string; parentId: string | null }>) {
  const map = new Map<string | null, string[]>();
  for (const folder of folders) {
    const key = folder.parentId ?? null;
    const entry = map.get(key) ?? [];
    entry.push(folder.id);
    map.set(key, entry);
  }
  return map;
}

function collectDescendants(
  rootId: string,
  childrenMap: Map<string | null, string[]>,
) {
  const stack = [rootId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const children = childrenMap.get(current) ?? [];
    for (const child of children) {
      if (!visited.has(child)) stack.push(child);
    }
  }

  return Array.from(visited);
}

function buildFolderPathMap(
  folders: Array<{ id: string; parentId: string | null; name: string }>,
  rootId: string,
) {
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const resolved = new Map<string, string>();
  const resolving = new Set<string>();
  const rootName = folderMap.get(rootId)?.name ?? "folder";

  const resolve = (folderId: string): string => {
    if (resolved.has(folderId)) return resolved.get(folderId) as string;
    if (resolving.has(folderId)) return rootName;
    const folder = folderMap.get(folderId);
    if (!folder) return rootName;
    resolving.add(folderId);
    const parentPath = folder.parentId ? resolve(folder.parentId) : rootName;
    const nextPath = folder.parentId ? `${parentPath}/${folder.name}` : rootName;
    resolving.delete(folderId);
    resolved.set(folderId, nextPath);
    return nextPath;
  };

  for (const folder of folders) {
    if (!resolved.has(folder.id)) {
      resolve(folder.id);
    }
  }

  return resolved;
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
      .createSignedUrl(storagePath, 60 * 2, { download: fileShare.file.fileName });

    if (error || !data?.signedUrl) {
      return NextResponse.json({ message: "Unable to create download URL" }, { status: 500 });
    }

    await db.activity.create({
      data: {
        userId: fileShare.userId,
        action: ActivityAction.DOWNLOAD,
        fileId: fileShare.file.id,
        metadata: {
          shareId: fileShare.id,
          fileId: fileShare.file.id,
          fileName: fileShare.file.fileName,
          shareToken: token,
          viewerIp: getClientIp(request),
          viewerAgent: request.headers.get("user-agent"),
        },
      },
    });

    return NextResponse.redirect(data.signedUrl, { status: 302 });
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
        const folderPath = file.folderId ? folderPathMap.get(file.folderId) : folderShare.folder.name;
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

  const storagePath = extractStoragePathFromUrl(file.fileUrl);
  if (!storagePath) {
    return NextResponse.json({ message: "Invalid storage path" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from("files")
    .createSignedUrl(storagePath, 60 * 2, { download: file.fileName });

  if (error || !data?.signedUrl) {
    return NextResponse.json({ message: "Unable to create download URL" }, { status: 500 });
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

  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
