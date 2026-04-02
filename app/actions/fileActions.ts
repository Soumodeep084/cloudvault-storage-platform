"use server"

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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