import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-help";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";
import archiver from "archiver";
import { PassThrough, Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { ActivityAction } from "@prisma/client";

export const runtime = "nodejs";

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

function collectDescendants(rootId: string, childrenMap: Map<string | null, string[]>) {
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
    if (!resolved.has(folder.id)) resolve(folder.id);
  }

  return resolved;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);

  const folder = await db.folder.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false,
      isTrashed: false,
    },
    select: { id: true, name: true, userId: true },
  });

  if (!folder) {
    return NextResponse.json({ message: "Folder not found" }, { status: 404 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ message: "Server storage config missing" }, { status: 500 });
  }

  const allFolders = await db.folder.findMany({
    where: { userId: user.id, isDeleted: false, isTrashed: false },
    select: { id: true, parentId: true, name: true },
  });

  const childrenMap = buildChildrenMap(allFolders);
  const folderIds = new Set(collectDescendants(folder.id, childrenMap));

  const files = await db.file.findMany({
    where: {
      userId: user.id,
      isDeleted: false,
      isTrashed: false,
      folderId: { in: Array.from(folderIds) },
    },
    select: { fileName: true, fileUrl: true, folderId: true },
    orderBy: { fileName: "asc" },
  });

  const folderPathMap = buildFolderPathMap(allFolders, folder.id);
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

      const signed = await supabaseAdmin.storage.from("files").createSignedUrl(storagePath, 60 * 5);
      const signedUrl = signed?.data?.signedUrl;
      if (!signedUrl) continue;

      const response = await fetch(signedUrl, { cache: "no-store" });
      if (!response.ok || !response.body) continue;

      const nodeStream = Readable.fromWeb(response.body as NodeReadableStream);
      const folderPath = file.folderId ? folderPathMap.get(file.folderId) : folder.name;
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
        userId: user.id,
        action: ActivityAction.DOWNLOAD,
        folderId: folder.id,
      },
    });

  const zipName = `${folder.name || "folder"}.zip`;
  return new NextResponse(Readable.toWeb(zipStream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "Cache-Control": "private, no-store",
    },
  });


  
}