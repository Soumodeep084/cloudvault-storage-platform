import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";
import { ActivityAction } from "@prisma/client";

const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;


// For Testing
// const TRASH_RETENTION_MS = 1 * 60 * 1000;       // 1 Minute

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

export async function GET() {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json(
                { error: "Supabase admin client is not configured" },
                { status: 500 }
            );
        }

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
                folders
                    .filter((folder) => folder.trashedDate && folder.trashedDate <= cutoff)
                    .map((folder) => folder.id),
            );

            const expiredRootIds = Array.from(expiredFolderSet).filter((folderId) => {
                const parentId = folderById.get(folderId)?.parentId ?? null;
                return !parentId || !expiredFolderSet.has(parentId);
            });

            for (const rootId of expiredRootIds) {
                const descendants = collectDescendants(rootId, childrenMap).filter((id) =>
                    expiredFolderSet.has(id),
                );
                const folderIds = new Set(descendants);
                const rootName = folderById.get(rootId)?.name ?? "Folder";

                rootFolderInfo.set(rootId, { userId, name: rootName, folderIds });
                for (const id of folderIds) {
                    expiredFolderIds.add(id);
                    rootFolderMap.set(id, rootId);
                }
            }
        }

        const fileFilters: Array<{ trashedDate?: { lte: Date }; folderId?: { in: string[] } }> = [
            { trashedDate: { lte: cutoff } },
        ];
        if (expiredFolderIds.size > 0) {
            fileFilters.push({ folderId: { in: Array.from(expiredFolderIds) } });
        }

        const expiredFiles = await db.file.findMany({
            where: { isTrashed: true, OR: fileFilters },
            select: { id: true, fileUrl: true, userId: true, fileName: true, folderId: true },
        });

        if (expiredFiles.length === 0 && expiredFolderIds.size === 0) {
            return NextResponse.json({
                success: true,
                deletedFiles: 0,
                deletedFolders: 0,
            });
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
            const summary = formatDeleteSummary(0, 1);
            const message = summary
                ? `Deleted from system after 30 days in Trash. ${summary}.`
                : "Deleted from system after 30 days in Trash.";

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

        return NextResponse.json({
            success: true,
            deletedFiles: expiredFiles.length,
            deletedFolders: expiredFolderIds.size,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Something went wrong";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}