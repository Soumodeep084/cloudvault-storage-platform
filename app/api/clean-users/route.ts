import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";

const STORAGE_DELETE_BATCH_SIZE = 1000;

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

export async function GET() {
    try {
        console.log("=================================");
        console.log("Clean-users cron started");

        if (!supabaseAdmin) {
            console.log("Supabase admin missing");

            return NextResponse.json(
                { error: "Supabase admin client is not configured" },
                { status: 500 }
            );
        }

        const now = new Date();

        const users = await db.user.findMany({
            where: {
                deleted: true,
                deletionScheduledAt: {
                    not: null,
                    lte: now,
                },
            },
            select: {
                id: true,
                deletionScheduledAt: true,
            },
        });

        console.log("Expired users found:", users.length);

        if (users.length === 0) {
            console.log("No users to delete");

            return NextResponse.json({
                success: true,
                message: "No expired users found",
            });
        }

        const userIds = users.map((user) => user.id);
        const files = await db.file.findMany({
            where: { userId: { in: userIds } },
            select: {
                fileUrl: true,
            },
        });

        console.log("Files found:", files.length);

        try {
            await removeStorageFiles(files.map((file) => file.fileUrl));
        } catch (storageError) {
            console.error("Storage delete failed:", storageError);
            return NextResponse.json(
                { error: "Failed to remove files from storage" },
                { status: 500 }
            );
        }

        const deletedUsers = await db.user.deleteMany({
            where: { id: { in: userIds } },
        });

        console.log("Users deleted:", deletedUsers.count);
        console.log("=================================");
        console.log("Cleanup completed");

        return NextResponse.json({
            success: true,
            deletedUsers: deletedUsers.count,
        });
    } catch (error: unknown) {
        console.error("Cleanup error:", error);

        const message = error instanceof Error ? error.message : "Something went wrong";

        return NextResponse.json({ error: message }, { status: 500 });
    }
}