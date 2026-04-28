"use server"

import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth-help";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { extractStoragePathFromUrl } from "@/lib/storage-path";
import bcrypt from "bcryptjs";

async function logActivity(userId: string, action: string, metadata?: Prisma.InputJsonValue) {
    await db.activityLog.create({
        data: {
            userId,
            action,
            metadata,
        },
    });
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
            let activityAction = "FILE_ADDED";

            if (existingFile) {
                fileId = existingFile.id;
                activityAction = "FILE_UPDATED";
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

            await tx.activityLog.create({
                data: {
                    userId: data.userId,
                    action: activityAction,
                    metadata: {
                        fileId,
                        fileName: data.fileName,
                        fileSize: data.fileSize,
                    },
                },
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

export async function createShareLink(
    fileId: string,
    options?: {
        password?: string;
        expiresInMinutes?: number | null;
    },
) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const normalizedPassword = options?.password?.trim();
        if (!normalizedPassword || normalizedPassword.length < 6) {
            return { success: false, error: "Password must be at least 6 characters" };
        }

        const expiresInMinutes = options?.expiresInMinutes ?? null;
        if (typeof expiresInMinutes === "number") {
            if (!Number.isFinite(expiresInMinutes) || expiresInMinutes <= 0) {
                return { success: false, error: "Expiry must be greater than zero" };
            }
            if (expiresInMinutes > 10080) {
                return { success: false, error: "Expiry cannot exceed 7 days" };
            }
        }
        const expiresAt = expiresInMinutes && expiresInMinutes > 0
            ? new Date(Date.now() + expiresInMinutes * 60 * 1000)
            : null;

        const passwordHash = await bcrypt.hash(normalizedPassword, 10);

        const file = await db.file.findFirst({
            where: { id: fileId, userId: user.id, isDeleted: false },
            include: { shares: true },
        });

        if (!file) {
            return { success: false, error: "File not found" };
        }

        const existingShare = file.shares[0];
        if (existingShare?.shareLink) {
            await db.share.update({
                where: { id: existingShare.id },
                data: {
                    password: passwordHash,
                    expiresAt,
                    isPublic: true,
                },
            });

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
                password: passwordHash,
                expiresAt,
            },
        });

        await logActivity(user.id, "FILE_SHARED", {
            fileId: file.id,
            fileName: file.fileName,
            shareLink,
            hasPassword: true,
            expiresAt: expiresAt?.toISOString() ?? null,
        });

        revalidatePath("/dashboard/shared");
        revalidatePath("/dashboard/history");

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
            select: { id: true, fileUrl: true, fileSize: true, fileName: true },
        });

        if (!file) {
            return { success: false, error: "File not found" };
        }

        const storagePath = extractStoragePathFromUrl(file.fileUrl);
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

            await tx.activityLog.create({
                data: {
                    userId: user.id,
                    action: "FILE_DELETED",
                    metadata: {
                        fileId: file.id,
                        fileName: file.fileName,
                    },
                },
            });
        });

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/files");
        revalidatePath("/dashboard/history");

        return { success: true };
    } catch (error) {
        console.error("Delete file error:", error);
        return { success: false, error: "Unable to delete file" };
    }
}

export async function revokeShareLink(fileId: string) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const file = await db.file.findFirst({
            where: {
                id: fileId,
                userId: user.id,
                isDeleted: false,
            },
            select: {
                id: true,
                fileName: true,
            },
        });

        if (!file) {
            return { success: false, error: "File not found" };
        }

        const existingShare = await db.share.findFirst({
            where: {
                fileId: file.id,
                userId: user.id,
            },
            select: {
                id: true,
            },
        });

        if (!existingShare) {
            return { success: false, error: "Share link not found" };
        }

        await db.share.delete({ where: { id: existingShare.id } });

        await logActivity(user.id, "FILE_UNSHARED", {
            fileId: file.id,
            fileName: file.fileName,
        });

        revalidatePath("/dashboard/files");
        revalidatePath("/dashboard/shared");
        revalidatePath("/dashboard/history");

        return { success: true };
    } catch (error) {
        console.error("Revoke share link error:", error);
        return { success: false, error: "Unable to revoke share link" };
    }
}
