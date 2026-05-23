"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-help";

function normalizeFolderName(name: string) {
  return name.trim();
}

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
      if (!visited.has(child)) {
        stack.push(child);
      }
    }
  }

  return Array.from(visited);
}

export async function createFolderAction(
  name: string,
  parentId?: string | null,
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const normalizedName = normalizeFolderName(name);
    if (!normalizedName) {
      return { success: false, error: "Folder name is required" };
    }

    if (parentId) {
      const parentExists = await db.folder.findFirst({
        where: { id: parentId, userId: user.id, isDeleted: false, isTrashed: false },
        select: { id: true },
      });

      if (!parentExists) {
        return { success: false, error: "Parent folder not found" };
      }
    }

      const duplicate = await db.folder.findFirst({
        where: {
          userId: user.id,
          parentId: parentId ?? null,
          isDeleted: false,
          isTrashed: false,
          name: { equals: normalizedName, mode: "insensitive" },
        },
      select: { id: true },
    });

    if (duplicate) {
      return { success: false, error: "A folder with this name already exists." };
    }

    const folder = await db.folder.create({
      data: {
        userId: user.id,
        parentId: parentId ?? null,
        name: normalizedName,
      },
      select: { id: true, name: true, parentId: true, createdAt: true, updatedAt: true },
    });

    revalidatePath("/dashboard/files");

    return { success: true, folder };
  } catch (error) {
    console.error("Create folder error:", error);
    return { success: false, error: "Unable to create folder" };
  }
}

export async function renameFolderAction(folderId: string, nextName: string) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const normalizedName = normalizeFolderName(nextName);
    if (!normalizedName) {
      return { success: false, error: "Folder name is required" };
    }

    const folder = await db.folder.findFirst({
      where: { id: folderId, userId: user.id, isDeleted: false, isTrashed: false },
      select: { id: true, parentId: true, name: true },
    });

    if (!folder) {
      return { success: false, error: "Folder not found" };
    }

    if (folder.name.toLowerCase() === normalizedName.toLowerCase()) {
      return { success: true, folderName: folder.name };
    }

    const duplicate = await db.folder.findFirst({
      where: {
        userId: user.id,
        parentId: folder.parentId ?? null,
        isDeleted: false,
        isTrashed: false,
        name: { equals: normalizedName, mode: "insensitive" },
        NOT: { id: folderId },
      },
      select: { id: true },
    });

    if (duplicate) {
      return { success: false, error: "A folder with this name already exists." };
    }

    const updated = await db.folder.update({
      where: { id: folderId },
      data: { name: normalizedName },
      select: { name: true },
    });

    revalidatePath("/dashboard/files");

    return { success: true, folderName: updated.name };
  } catch (error) {
    console.error("Rename folder error:", error);
    return { success: false, error: "Unable to rename folder" };
  }
}

export async function moveFolderAction(
  folderId: string,
  destinationParentId: string | null,
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const folder = await db.folder.findFirst({
      where: { id: folderId, userId: user.id, isDeleted: false, isTrashed: false },
      select: { id: true, parentId: true, name: true },
    });

    if (!folder) {
      return { success: false, error: "Folder not found" };
    }

    if (destinationParentId === folderId) {
      return { success: false, error: "Cannot move a folder into itself" };
    }

    if (destinationParentId) {
      const parentExists = await db.folder.findFirst({
        where: { id: destinationParentId, userId: user.id, isDeleted: false, isTrashed: false },
        select: { id: true },
      });

      if (!parentExists) {
        return { success: false, error: "Destination folder not found" };
      }
    }

    const allFolders = await db.folder.findMany({
      where: { userId: user.id, isDeleted: false, isTrashed: false },
      select: { id: true, parentId: true },
    });

    const childrenMap = buildChildrenMap(allFolders);
    const descendants = new Set(collectDescendants(folderId, childrenMap));

    if (destinationParentId && descendants.has(destinationParentId)) {
      return { success: false, error: "Cannot move a folder into its own descendant" };
    }

    const duplicate = await db.folder.findFirst({
      where: {
        userId: user.id,
        parentId: destinationParentId ?? null,
        isDeleted: false,
        isTrashed: false,
        name: { equals: folder.name, mode: "insensitive" },
        NOT: { id: folderId },
      },
      select: { id: true },
    });

    if (duplicate) {
      return { success: false, error: "A folder with this name already exists." };
    }

    await db.folder.update({
      where: { id: folderId },
      data: { parentId: destinationParentId ?? null },
    });

    revalidatePath("/dashboard/files");

    return { success: true };
  } catch (error) {
    console.error("Move folder error:", error);
    return { success: false, error: "Unable to move folder" };
  }
}

export async function deleteFolderAction(folderId: string) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const rootFolder = await db.folder.findFirst({
      where: { id: folderId, userId: user.id, isDeleted: false, isTrashed: false },
      select: { id: true, parentId: true },
    });

    if (!rootFolder) {
      return { success: false, error: "Folder not found" };
    }

    const allFolders = await db.folder.findMany({
      where: { userId: user.id, isDeleted: false, isTrashed: false },
      select: { id: true, parentId: true },
    });

    const childrenMap = buildChildrenMap(allFolders);
    const folderIds = collectDescendants(folderId, childrenMap);

    const trashedAt = new Date();

    await db.$transaction(async (tx) => {
      await tx.folder.updateMany({
        where: { id: { in: folderIds } },
        data: { isTrashed: true, trashedDate: trashedAt },
      });

      await tx.file.updateMany({
        where: { userId: user.id, isDeleted: false, isTrashed: false, folderId: { in: folderIds } },
        data: { isTrashed: true, trashedDate: trashedAt },
      });
    });

    revalidatePath("/dashboard/files");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/trash");

    return { success: true, parentId: rootFolder.parentId ?? null };
  } catch (error) {
    console.error("Delete folder error:", error);
    return { success: false, error: "Unable to delete folder" };
  }
}
