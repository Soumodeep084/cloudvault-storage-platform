"use server"

import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth-help";
import { revalidatePath } from "next/cache";

function extractStoragePath(fileUrl: string): string | null {
    const markers = [
        "/storage/v1/object/public/files/",
        "/storage/v1/object/sign/files/",
    ];

    for (const marker of markers) {
        const markerIndex = fileUrl.indexOf(marker);
        if (markerIndex === -1) continue;

        const rawPath = fileUrl.slice(markerIndex + marker.length).split("?")[0];
        return decodeURIComponent(rawPath);
    }

    return null;
}

// Explicitly define the interface to fix the 'userId' error
export async function recordFileUpload(data: {
    userId: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
}) {
    try {
        const result = await db.$transaction(async (tx) => {
            // 1. Check for existing file for versioning
            const existingFile = await tx.file.findFirst({
                where: { userId: data.userId, fileName: data.fileName, isDeleted: false },
                include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
            });

            let fileId: string;

            if (existingFile) {
                fileId = existingFile.id;
                const nextVersion = (existingFile.versions[0]?.version || 1) + 1;

                await tx.fileVersion.create({
                    data: { fileId, version: nextVersion, fileUrl: data.fileUrl }
                });

                await tx.file.update({
                    where: { id: fileId },
                    data: { fileUrl: data.fileUrl, fileSize: data.fileSize }
                });
            } else {
                const newFile = await tx.file.create({
                    data: {
                        userId: data.userId,
                        fileName: data.fileName,
                        fileUrl: data.fileUrl,
                        fileSize: data.fileSize,
                        fileType: data.fileType,
                        versions: { create: { version: 1, fileUrl: data.fileUrl } }
                    }
                });
                fileId = newFile.id;
            }

            // 2. Increment user storage
            await tx.user.update({
                where: { id: data.userId },
                data: { storageUsed: { increment: data.fileSize } }
            });

            return { success: true, fileId };
        });

        revalidatePath("/dashboard");
        return result;
    } catch (error) {
        console.error("Database Error:", error);
        return { success: false, error: "Failed to save file info" };
    }
}

export async function createShareLink(fileId: string) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const file = await db.file.findFirst({
            where: { id: fileId, userId: user.id, isDeleted: false },
            include: { shares: true },
        });

        if (!file) {
            return { success: false, error: "File not found" };
        }

        const existingShare = file.shares[0];
        if (existingShare?.shareLink) {
            return { success: true, shareLink: existingShare.shareLink };
        }

        const shareBaseUrl = process.env.SHARE_BASE_URL?.trim() || "http://localhost:3000";
        const shareLink = `${shareBaseUrl.replace(/\/$/, "")}/s/${crypto.randomUUID()}`;

        await db.share.create({
            data: {
                fileId: file.id,
                userId: user.id,
                shareLink,
                isPublic: true,
            },
        });

        revalidatePath("/dashboard/shared");

        return { success: true, shareLink };
    } catch (error) {
        console.error("Create share link error:", error);
        return { success: false, error: "Unable to create share link" };
    }
}

export async function deleteFileAction(fileId: string) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const file = await db.file.findFirst({
            where: { id: fileId, userId: user.id, isDeleted: false },
            select: { id: true, fileUrl: true, fileSize: true },
        });

        if (!file) {
            return { success: false, error: "File not found" };
        }

        const storagePath = extractStoragePath(file.fileUrl);
        if (!storagePath) {
            return { success: false, error: "Invalid storage URL for file" };
        }

        if (!supabaseAdmin) {
            return { success: false, error: "Supabase admin client is not configured" };
        }

        const { error: storageError } = await supabaseAdmin.storage
            .from("files")
            .remove([storagePath]);

        if (storageError) {
            return { success: false, error: storageError.message || "Failed to delete file from storage" };
        }

        await db.$transaction(async (tx) => {
            await tx.file.delete({ where: { id: file.id } });

            if (file.fileSize) {
                await tx.user.update({
                    where: { id: user.id },
                    data: { storageUsed: { decrement: BigInt(file.fileSize) } },
                });
            }
        });

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/files");

        return { success: true };
    } catch (error) {
        console.error("Delete file error:", error);
        return { success: false, error: "Unable to delete file" };
    }
}
