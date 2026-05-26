"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-help";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";
import { ActivityAction } from "@prisma/client";

const TRASH_RETENTION_DAYS = 30;

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

async function deleteStorageFiles(fileUrls: string[]) {
  if (!supabaseAdmin) return;
  const paths = fileUrls
    .map((fileUrl) => extractStoragePathFromUrl(fileUrl))
    .filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  await supabaseAdmin.storage.from("files").remove(paths);
}

function formatDeleteSummary(folderCount: number, fileCount: number) {
  const parts: string[] = [];
  if (folderCount > 0) {
    parts.push(`${folderCount} folder${folderCount === 1 ? "" : "s"}`);
  }
  if (fileCount > 0) {
    parts.push(`${fileCount} file${fileCount === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

export async function restoreFileAction(fileId: string) {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const file = await db.file.findFirst({
    where: { id: fileId, userId: user.id, isDeleted: false, isTrashed: true },
    select: { id: true, folderId: true },
  });

  if (!file) return { success: false, error: "File not found" };

  let nextFolderId: string | null = file.folderId ?? null;
  if (nextFolderId) {
    const folder = await db.folder.findFirst({
      where: { id: nextFolderId, userId: user.id, isDeleted: false },
      select: { isTrashed: true },
    });
    if (!folder) {
      nextFolderId = null;
    } else if (folder.isTrashed) {
      return { success: false, error: "Restore the parent folder instead." };
    }
  }

  await db.file.update({
    where: { id: file.id },
    data: { isTrashed: false, trashedDate: null, folderId: nextFolderId },
  });

  revalidatePath("/dashboard/trash");
  revalidatePath("/dashboard/files");

  return { success: true };
}

export async function restoreFolderAction(folderId: string) {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const rootFolder = await db.folder.findFirst({
    where: { id: folderId, userId: user.id, isDeleted: false, isTrashed: true },
    select: { id: true, parentId: true },
  });

  if (!rootFolder) return { success: false, error: "Folder not found" };

  const allFolders = await db.folder.findMany({
    where: { userId: user.id, isDeleted: false },
    select: { id: true, parentId: true, isTrashed: true },
  });

  const childrenMap = buildChildrenMap(allFolders);
  const folderIds = collectDescendants(rootFolder.id, childrenMap);

  const parentFolder = rootFolder.parentId
    ? allFolders.find((folder) => folder.id === rootFolder.parentId)
    : null;

  await db.$transaction(async (tx) => {
    await tx.folder.updateMany({
      where: { id: { in: folderIds }, isTrashed: true },
      data: { isTrashed: false, trashedDate: null },
    });

    if (parentFolder?.isTrashed || !parentFolder) {
      await tx.folder.update({
        where: { id: rootFolder.id },
        data: { parentId: null },
      });
    }

    await tx.file.updateMany({
      where: { userId: user.id, isDeleted: false, folderId: { in: folderIds }, isTrashed: true },
      data: { isTrashed: false, trashedDate: null },
    });
  });

  revalidatePath("/dashboard/trash");
  revalidatePath("/dashboard/files");

  return { success: true };
}

export async function deleteFilePermanentlyAction(fileId: string) {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const file = await db.file.findFirst({
    where: { id: fileId, userId: user.id, isDeleted: false, isTrashed: true },
    select: { id: true, fileUrl: true, fileName: true },
  });

  if (!file) return { success: false, error: "File not found" };

  await deleteStorageFiles([file.fileUrl]);
  await db.$transaction(async (tx) => {
    await tx.activity.create({
      data: {
        userId: user.id,
        action: ActivityAction.DELETE,
        fileId: file.id,
        metadata: {
          fileId: file.id,
          fileName: file.fileName,
          kind: "trash-permanent-delete",
        },
      },
    });

    await tx.file.delete({ where: { id: file.id } });
  });

  revalidatePath("/dashboard/trash");
  revalidatePath("/dashboard/history");

  return { success: true };
}

export async function deleteFolderPermanentlyAction(folderId: string) {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const rootFolder = await db.folder.findFirst({
    where: { id: folderId, userId: user.id, isDeleted: false, isTrashed: true },
    select: { id: true, name: true },
  });

  if (!rootFolder) return { success: false, error: "Folder not found" };

  const allFolders = await db.folder.findMany({
    where: { userId: user.id, isDeleted: false },
    select: { id: true, parentId: true, isTrashed: true },
  });

  const childrenMap = buildChildrenMap(allFolders);
  const folderIds = collectDescendants(rootFolder.id, childrenMap);

  const files = await db.file.findMany({
    where: {
      userId: user.id,
      isDeleted: false,
      isTrashed: true,
      folderId: { in: folderIds },
    },
    select: { id: true, fileUrl: true },
  });

  await deleteStorageFiles(files.map((item) => item.fileUrl));

  const folderCount = folderIds.length;
  const fileCount = files.length;
  const summary = formatDeleteSummary(folderCount, fileCount);

  await db.$transaction(async (tx) => {
    await tx.activity.create({
      data: {
        userId: user.id,
        action: ActivityAction.DELETE,
        fileId: null,
        metadata: {
          kind: "trash-permanent-delete",
          folderId: rootFolder.id,
          folderName: rootFolder.name,
          folderCount,
          fileCount,
          message: summary ? `Deleted from Trash: ${summary}.` : "Deleted from Trash.",
        },
      },
    });

    await tx.file.deleteMany({
      where: { id: { in: files.map((item) => item.id) } },
    });

    await tx.folder.deleteMany({
      where: { id: { in: folderIds } },
    });
  });

  revalidatePath("/dashboard/trash");
  revalidatePath("/dashboard/history");

  return { success: true };
}

export async function purgeExpiredTrashAction() {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const trashedFolders = await db.folder.findMany({
    where: { userId: user.id, isDeleted: false, isTrashed: true },
    select: { id: true, parentId: true, trashedDate: true, name: true },
  });

  const childrenMap = buildChildrenMap(trashedFolders);
  const folderById = new Map(trashedFolders.map((folder) => [folder.id, folder]));
  const expiredFolderSet = new Set(
    trashedFolders
      .filter((folder) => folder.trashedDate && folder.trashedDate <= cutoff)
      .map((folder) => folder.id),
  );
  const expiredRootIds = Array.from(expiredFolderSet).filter((folderId) => {
    const parentId = folderById.get(folderId)?.parentId ?? null;
    return !parentId || !expiredFolderSet.has(parentId);
  });

  const expiredFolderIds = new Set<string>();
  const rootFolderMap = new Map<string, string>();
  const rootFolderInfo = new Map<string, { name: string; folderIds: Set<string> }>();

  for (const rootId of expiredRootIds) {
    const descendants = collectDescendants(rootId, childrenMap).filter((id) =>
      expiredFolderSet.has(id),
    );
    const folderIds = new Set(descendants);
    const rootName = folderById.get(rootId)?.name ?? "Folder";

    rootFolderInfo.set(rootId, { name: rootName, folderIds });
    for (const id of folderIds) {
      expiredFolderIds.add(id);
      rootFolderMap.set(id, rootId);
    }
  }

  const expiredFiles = await db.file.findMany({
    where: {
      userId: user.id,
      isDeleted: false,
      isTrashed: true,
      OR: [
        { trashedDate: { lte: cutoff } },
        { folderId: { in: Array.from(expiredFolderIds) } },
      ],
    },
    select: { id: true, fileUrl: true, fileName: true, folderId: true },
  });

  if (expiredFiles.length === 0 && expiredFolderIds.size === 0) {
    return { success: true, deletedFiles: 0, deletedFolders: 0 };
  }

  await deleteStorageFiles(expiredFiles.map((item) => item.fileUrl));

  const rootFileCounts = new Map<string, number>();
  for (const file of expiredFiles) {
    if (!file.folderId) continue;
    const rootId = rootFolderMap.get(file.folderId);
    if (!rootId) continue;
    rootFileCounts.set(rootId, (rootFileCounts.get(rootId) ?? 0) + 1);
  }

  const activityPayload = [] as Array<{
    userId: string;
    action: ActivityAction;
    fileId: string | null;
    metadata: {
      kind: string;
      folderId?: string;
      folderName?: string;
      folderCount: number;
      fileCount: number;
      fileId?: string;
      fileName?: string;
      message: string;
      badge: string;
    };
  }>;

  for (const [rootId, info] of rootFolderInfo.entries()) {
    const folderCount = info.folderIds.size;
    const fileCount = rootFileCounts.get(rootId) ?? 0;
    const summary = formatDeleteSummary(folderCount, fileCount);
    const message = summary
      ? `Deleted from system after 30 days in Trash. ${summary}.`
      : "Deleted from system after 30 days in Trash.";

    activityPayload.push({
      userId: user.id,
      action: ActivityAction.DELETE,
      fileId: null,
      metadata: {
        kind: "trash-auto-delete",
        folderId: rootId,
        folderName: info.name,
        folderCount,
        fileCount,
        message,
        badge: "Deleted from system after 30 days in Trash.",
      },
    });
  }

  for (const file of expiredFiles) {
    const isInExpiredFolder = file.folderId && expiredFolderIds.has(file.folderId);
    if (isInExpiredFolder) continue;
    const summary = formatDeleteSummary(0, 1);
    const message = summary
      ? `Deleted from system after 30 days in Trash. ${summary}.`
      : "Deleted from system after 30 days in Trash.";

    activityPayload.push({
      userId: user.id,
      action: ActivityAction.DELETE,
      fileId: file.id,
      metadata: {
        kind: "trash-auto-delete",
        folderCount: 0,
        fileCount: 1,
        fileId: file.id,
        fileName: file.fileName,
        message,
        badge: "Deleted from system after 30 days in Trash.",
      },
    });
  }

  await db.$transaction(async (tx) => {
    if (activityPayload.length > 0) {
      await tx.activity.createMany({ data: activityPayload });
    }

    if (expiredFiles.length > 0) {
      await tx.file.deleteMany({
        where: { id: { in: expiredFiles.map((item) => item.id) } },
      });
    }

    if (expiredFolderIds.size > 0) {
      await tx.folder.deleteMany({
        where: { id: { in: Array.from(expiredFolderIds) } },
      });
    }
  });

  revalidatePath("/dashboard/trash");
  revalidatePath("/dashboard/history");

  return {
    success: true,
    deletedFiles: expiredFiles.length,
    deletedFolders: expiredFolderIds.size,
  };
}
