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
            select: { id: true, parentId: true, trashedDate: true, userId: true },
        });

        const childrenMap = buildChildrenMap(trashedFolders);
        const folderUserMap = new Map<string, string>();
        for (const folder of trashedFolders) {
            folderUserMap.set(folder.id, folder.userId);
        }

        const expiredFolderIdsByUser = new Map<string, Set<string>>();
        for (const folder of trashedFolders) {
            if (!folder.trashedDate || folder.trashedDate > cutoff) continue;
            for (const id of collectDescendants(folder.id, childrenMap)) {
                const ownerId = folderUserMap.get(id) ?? folder.userId;
                const bucket = expiredFolderIdsByUser.get(ownerId) ?? new Set<string>();
                bucket.add(id);
                expiredFolderIdsByUser.set(ownerId, bucket);
            }
        }

        const expiredFolderList = Array.from(
            new Set(Array.from(expiredFolderIdsByUser.values()).flatMap((set) => Array.from(set))),
        );
        const fileFilters: Array<{ trashedDate?: { lte: Date }; folderId?: { in: string[] } }> = [
            { trashedDate: { lte: cutoff } },
        ];
        if (expiredFolderList.length > 0) {
            fileFilters.push({ folderId: { in: expiredFolderList } });
        }

        const expiredFiles = await db.file.findMany({
            where: { isTrashed: true, OR: fileFilters },
            select: { id: true, fileUrl: true, userId: true },
        });

        if (expiredFiles.length === 0 && expiredFolderList.length === 0) {
            return NextResponse.json({
                success: true,
                deletedFiles: 0,
                deletedFolders: 0,
            });
        }

        await deleteStorageFiles(expiredFiles.map((item) => item.fileUrl));

        const fileCountsByUser = new Map<string, number>();
        for (const file of expiredFiles) {
            fileCountsByUser.set(file.userId, (fileCountsByUser.get(file.userId) ?? 0) + 1);
        }

        const affectedUsers = new Set<string>([...expiredFolderIdsByUser.keys(), ...fileCountsByUser.keys()]);
        const activityPayload = Array.from(affectedUsers).map((userId) => {
            const folderCount = expiredFolderIdsByUser.get(userId)?.size ?? 0;
            const fileCount = fileCountsByUser.get(userId) ?? 0;
            const summary = formatDeleteSummary(folderCount, fileCount);
            const message = summary
                ? `Deleted from system after 30 days in Trash. ${summary}.`
                : "Deleted from system after 30 days in Trash.";
            return {
                userId,
                action: ActivityAction.DELETE,
                fileId: null,
                metadata: {
                    kind: "trash-auto-delete",
                    folderCount,
                    fileCount,
                    message,
                    badge: "Deleted from system after 30 days in Trash.",
                },
            };
        });

        await db.$transaction(async (tx) => {
            if (activityPayload.length > 0) {
                await tx.activity.createMany({ data: activityPayload });
            }

            if (expiredFiles.length > 0) {
                await tx.file.deleteMany({
                    where: { id: { in: expiredFiles.map((item) => item.id) } },
                });
            }

            if (expiredFolderList.length > 0) {
                await tx.folder.deleteMany({
                    where: { id: { in: expiredFolderList } },
                });
            }
        });

        return NextResponse.json({
            success: true,
            deletedFiles: expiredFiles.length,
            deletedFolders: expiredFolderList.length,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Something went wrong";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}