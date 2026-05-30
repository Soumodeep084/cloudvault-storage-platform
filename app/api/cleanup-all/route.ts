import { NextResponse } from "next/server";
import { ActivityAction } from "@prisma/client";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";

const STORAGE_DELETE_BATCH_SIZE = 1000;
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

async function removeStorageFiles(fileUrls: string[]) {
  if (!supabaseAdmin || fileUrls.length === 0) return;

  const paths = fileUrls
    .map((fileUrl) => extractStoragePathFromUrl(fileUrl))
    .filter((path): path is string => Boolean(path));

  for (let index = 0; index < paths.length; index += STORAGE_DELETE_BATCH_SIZE) {
    const batch = paths.slice(index, index + STORAGE_DELETE_BATCH_SIZE);
    const { error } = await supabaseAdmin.storage.from("files").remove(batch);
    if (error) {
      throw error;
    }
  }
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

function formatDeleteSummary(folderCount: number, fileCount: number) {
  const parts: string[] = [];
  if (folderCount > 0) parts.push(`${folderCount} folder${folderCount === 1 ? "" : "s"}`);
  if (fileCount > 0) parts.push(`${fileCount} file${fileCount === 1 ? "" : "s"}`);
  return parts.join(", ");
}

async function cleanupExpiredUsers() {
  const now = new Date();
  const users = await db.user.findMany({
    where: {
      deleted: true,
      deletionScheduledAt: { not: null, lte: now },
    },
    select: { id: true },
  });

  if (users.length === 0) {
    return { deletedUsers: 0, message: "No expired users found" };
  }

  const userIds = users.map((user) => user.id);
  const files = await db.file.findMany({
    where: { userId: { in: userIds } },
    select: { fileUrl: true },
  });

  await removeStorageFiles(files.map((file) => file.fileUrl));

  const deletedUsers = await db.user.deleteMany({ where: { id: { in: userIds } } });
  return { deletedUsers: deletedUsers.count };
}

async function cleanupTrash() {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_MS);

  const trashedFolders = await db.folder.findMany({
    where: { isTrashed: true, trashedDate: { not: null } },
    select: { id: true, parentId: true, trashedDate: true, userId: true, name: true },
  });

  const foldersByUser = new Map<string, typeof trashedFolders>();
  const folderById = new Map<string, (typeof trashedFolders)[number]>();
  for (const folder of trashedFolders) {
    folderById.set(folder.id, folder);
    const bucket = foldersByUser.get(folder.userId) ?? [];
    bucket.push(folder);
    foldersByUser.set(folder.userId, bucket);
  }

  const expiredFolderIds = new Set<string>();
  const rootFolderMap = new Map<string, string>();
  const rootFolderInfo = new Map<string, { userId: string; name: string; folderIds: Set<string> }>();

  for (const [userId, folders] of foldersByUser.entries()) {
    const childrenMap = buildChildrenMap(folders);
    const expiredFolderSet = new Set(
      folders.filter((folder) => folder.trashedDate && folder.trashedDate <= cutoff).map((folder) => folder.id),
    );

    const expiredRootIds = Array.from(expiredFolderSet).filter((folderId) => {
      const parentId = folderById.get(folderId)?.parentId ?? null;
      return !parentId || !expiredFolderSet.has(parentId);
    });

    for (const rootId of expiredRootIds) {
      const descendants = collectDescendants(rootId, childrenMap).filter((id) => expiredFolderSet.has(id));
      const folderIds = new Set(descendants);
      const rootName = folderById.get(rootId)?.name ?? "Folder";

      rootFolderInfo.set(rootId, { userId, name: rootName, folderIds });
      for (const id of folderIds) {
        expiredFolderIds.add(id);
        rootFolderMap.set(id, rootId);
      }
    }
  }

  const fileFilters: Array<{ trashedDate?: { lte: Date }; folderId?: { in: string[] } }> = [{ trashedDate: { lte: cutoff } }];
  if (expiredFolderIds.size > 0) {
    fileFilters.push({ folderId: { in: Array.from(expiredFolderIds) } });
  }

  const expiredFiles = await db.file.findMany({
    where: { isTrashed: true, OR: fileFilters },
    select: { id: true, fileUrl: true, userId: true, fileName: true, folderId: true },
  });

  if (expiredFiles.length === 0 && expiredFolderIds.size === 0) {
    return { deletedFiles: 0, deletedFolders: 0, message: "No expired trash found" };
  }

  await removeStorageFiles(expiredFiles.map((item) => item.fileUrl));

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
      userId: info.userId,
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
    const message = "Deleted from system after 30 days in Trash.";

    activityPayload.push({
      userId: file.userId,
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
      await tx.file.deleteMany({ where: { id: { in: expiredFiles.map((item) => item.id) } } });
    }

    if (expiredFolderIds.size > 0) {
      await tx.folder.deleteMany({ where: { id: { in: Array.from(expiredFolderIds) } } });
    }
  });

  return { deletedFiles: expiredFiles.length, deletedFolders: expiredFolderIds.size };
}

async function cleanupExpiredSessionsAndShares() {
  const now = new Date();

  const [expiredSessions, expiredTokens, expiredShares, expiredFolderShares] = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lte: now } } }),
    db.token.deleteMany({ where: { expiresAt: { lte: now } } }),
    db.share.deleteMany({ where: { expiresAt: { lte: now } } }),
    db.folderShare.deleteMany({ where: { expiresAt: { lte: now } } }),
  ]);

  return {
    deletedSessions: expiredSessions.count,
    deletedTokens: expiredTokens.count,
    deletedShares: expiredShares.count,
    deletedFolderShares: expiredFolderShares.count,
  };
}

export async function GET() {
  try {
    const [usersResult, trashResult, expiringResult] = await Promise.allSettled([
      cleanupExpiredUsers(),
      cleanupTrash(),
      cleanupExpiredSessionsAndShares(),
    ]);

    const response = {
      success: true,
      cleanupUsers: usersResult.status === "fulfilled" ? usersResult.value : { error: String(usersResult.reason) },
      cleanupTrash: trashResult.status === "fulfilled" ? trashResult.value : { error: String(trashResult.reason) },
      cleanupExpired: expiringResult.status === "fulfilled" ? expiringResult.value : { error: String(expiringResult.reason) },
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}