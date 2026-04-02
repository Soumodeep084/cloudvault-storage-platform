"use server"

import { db } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-help";
import { revalidatePath } from "next/cache";

export async function recordFileUpload(data: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
}) {
    const user = await getSessionUser();
    if (!user) throw new Error("Unauthorized");

    // 1. Check if file with same name exists (Versioning Logic)
    const existingFile = await db.file.findFirst({
        where: {
            userId: user.id,
            fileName: data.fileName,
            isDeleted: false
        },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
    });

    try {
        return await db.$transaction(async (tx) => {
            let fileId: string;

            if (existingFile) {
                fileId = existingFile.id;
                const nextVersion = (existingFile.versions[0]?.version || 1) + 1;

                // Create new version
                await tx.fileVersion.create({
                    data: {
                        fileId,
                        version: nextVersion,
                        fileUrl: data.fileUrl,
                    }
                });

                // Update main file pointer
                await tx.file.update({
                    where: { id: fileId },
                    data: {
                        fileUrl: data.fileUrl,
                        fileSize: data.fileSize
                    }
                });
            } else {
                // Create brand new file record
                const newFile = await tx.file.create({
                    data: {
                        userId: user.id,
                        fileName: data.fileName,
                        fileUrl: data.fileUrl,
                        fileSize: data.fileSize,
                        fileType: data.fileType,
                        versions: {
                            create: {
                                version: 1,
                                fileUrl: data.fileUrl,
                            }
                        }
                    }
                });
                fileId = newFile.id;
            }

            // 2. Update User's total storage used
            await tx.user.update({
                where: { id: user.id },
                data: {
                    // Note: In real app, you'd add some logic to check limits here
                    storageUsed: { increment: data.fileSize }
                }
            });

            // 3. Log the activity
            await tx.activityLog.create({
                data: {
                    userId: user.id,
                    action: existingFile ? "Updated File" : "Uploaded File",
                    metadata: { fileName: data.fileName, size: data.fileSize }
                }
            });

            // Refresh the dashboard data
            revalidatePath("/dashboard");
            return { success: true, fileId };
        });
    } catch (error) {
        console.error("Upload Action Error:", error);
        return { success: false, error: "Failed to sync with database" };
    }
}