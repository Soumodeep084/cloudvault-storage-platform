// app/api/cleanup/route.ts

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";

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

        // STEP 1:Find users whose delete time has expired
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

        if (!users || users.length === 0) {
            console.log("No users to delete");

            return NextResponse.json({
                success: true,
                message: "No expired users found",
            });
        }

        let deletedUsers = 0;

        for (const user of users) {
            console.log("---------------------------------");
            console.log("Deleting user:", user.id);
            console.log(
                "Scheduled deletion:",
                user.deletionScheduledAt
            );

            // STEP 2: Get all files of this user
            const files = await db.file.findMany({
                where: { userId: user.id },
                select: {
                    id: true,
                    fileUrl: true,
                },
            });

            console.log("Files found:", files.length);

            // STEP 3: Delete files from Supabase Storage
            if (files.length > 0) {
                const paths = files
                    .map((file) =>
                        extractStoragePathFromUrl(file.fileUrl)
                    )
                    .filter(
                        (path): path is string => Boolean(path)
                    );

                console.log("Storage paths:", paths);

                if (paths.length > 0) {
                    const { error: storageError } =
                        await supabaseAdmin.storage
                            .from("files")
                            .remove(paths);

                    if (storageError) {
                        console.error(
                            "Storage delete failed:",
                            storageError
                        );

                        continue;
                    }

                    console.log("Storage files deleted");
                }
            }

            // STEP 4: Delete user record
            await db.user.delete({
                where: { id: user.id },
            });

            deletedUsers += 1;

            console.log(
                `User ${user.id} fully deleted`
            );
        }

        console.log("=================================");
        console.log("Cleanup completed");

        return NextResponse.json({
            success: true,
            deletedUsers,
        });
    } catch (error: unknown) {
        console.error("Cleanup error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Something went wrong";

        return NextResponse.json({ error: message }, { status: 500 });
    }
}