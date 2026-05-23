import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";

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
            select: { id: true, parentId: true, trashedDate: true },
        });

        const childrenMap = buildChildrenMap(trashedFolders);
        const expiredFolderIds = new Set<string>();
        for (const folder of trashedFolders) {
            if (!folder.trashedDate || folder.trashedDate > cutoff) continue;
            for (const id of collectDescendants(folder.id, childrenMap)) {
                expiredFolderIds.add(id);
            }
        }

        const expiredFolderList = Array.from(expiredFolderIds);
        const fileFilters: Array<{ trashedDate?: { lte: Date }; folderId?: { in: string[] } }> = [
            { trashedDate: { lte: cutoff } },
        ];
        if (expiredFolderList.length > 0) {
            fileFilters.push({ folderId: { in: expiredFolderList } });
        }

        const expiredFiles = await db.file.findMany({
            where: { isTrashed: true, OR: fileFilters },
            select: { id: true, fileUrl: true },
        });

        if (expiredFiles.length === 0 && expiredFolderIds.size === 0) {
            return NextResponse.json({
                success: true,
                deletedFiles: 0,
                deletedFolders: 0,
            });
        }

        await deleteStorageFiles(expiredFiles.map((item) => item.fileUrl));

        await db.$transaction(async (tx) => {
            if (expiredFiles.length > 0) {
                await tx.file.deleteMany({
                    where: { id: { in: expiredFiles.map((item) => item.id) } },
                });
            }

            if (expiredFolderIds.size > 0) {
                await tx.folder.deleteMany({
                    where: { id: { in: expiredFolderList } },
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