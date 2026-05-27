import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-help";
import { buildShareLink } from "@/lib/share-link";
import SharedClient from "./SharedClient";

function buildChildrenMap(
  folders: Array<{ id: string; parentId: string | null }>,
) {
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

export default async function SharedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const shares = await db.share.findMany({
    where: {
      userId: user.id,
      file: { isDeleted: false },
    },
    include: {
      file: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const sharedFiles = shares.map((share) => ({
    id: share.id,
    fileId: share.fileId,
    fileName: share.file.fileName,
    fileSize: share.file.fileSize ?? 0,
    fileType: share.file.fileType,
    updatedAt: share.file.updatedAt,
    shareLink: buildShareLink(share.token),
    expiresAt: share.expiresAt,
    sharedAt: share.createdAt,
    kind: "file" as const,
  }));

  const folderShares = await db.folderShare.findMany({
    where: {
      userId: user.id,
      folder: { isDeleted: false, isTrashed: false },
    },
    include: {
      folder: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const allFolders = await db.folder.findMany({
    where: { userId: user.id, isDeleted: false, isTrashed: false },
    select: { id: true, parentId: true },
  });

  const fileRows = await db.file.findMany({
    where: { userId: user.id, isDeleted: false, isTrashed: false },
    select: { id: true, folderId: true },
  });

  const childrenMap = buildChildrenMap(allFolders);
  const sharedFolders = folderShares.map((share) => {
    const folderIds = new Set(collectDescendants(share.folderId, childrenMap));
    const fileCount = fileRows.reduce((count, file) =>
      file.folderId && folderIds.has(file.folderId) ? count + 1 : count,
    0);
    const folderCount = Math.max(0, folderIds.size - 1);

    return {
      id: share.id,
      folderId: share.folderId,
      folderName: share.folder.name,
      shareLink: buildShareLink(share.token),
      expiresAt: share.expiresAt,
      sharedAt: share.createdAt,
      fileCount,
      folderCount,
      kind: "folder" as const,
    };
  });

  return <SharedClient initialShares={[...sharedFiles, ...sharedFolders]} />;
}
