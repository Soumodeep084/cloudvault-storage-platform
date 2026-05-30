"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-help";
import { sendAdminAccountPermanentlyDeletedEmail, sendAdminAccountRestoredEmail, sendDeletionScheduledEmail } from "@/lib/email";
import type { Prisma } from "@prisma/client";

type AdminActionResult = { success: boolean; error?: string };

function serializeStorageBytes(bytes: bigint | number) {
  return typeof bytes === "bigint" ? bytes.toString() : String(Math.trunc(bytes));
}

function getDeletionScheduleDate() {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  return next;
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" as const };
  if (user.role !== "ADMIN") return { error: "Forbidden" as const };
  return { user };
}

async function writeSystemLog(input: {
  action: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await db.systemLog.create({
    data: {
      action: input.action,
      targetUserId: input.targetUserId ?? null,
      targetEmail: input.targetEmail ?? null,
      metadata: input.metadata ?? {},
    },
  });
}

export async function softDeleteUserByAdminAction(targetUserId: string): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { success: false, error: auth.error };

  if (auth.user.id === targetUserId) {
    return { success: false, error: "You cannot delete your own account." };
  }

  try {
    const target = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        deleted: true,
        _count: { select: { files: true, folders: true } },
        storageUsed: true,
      },
    });

    if (!target) return { success: false, error: "User not found." };
    if (target.deleted) return { success: false, error: "User already deleted." };

    const scheduled = getDeletionScheduleDate();
    await sendDeletionScheduledEmail({
      to: target.email,
      name: target.name,
      scheduledFor: scheduled,
    });

    await db.user.update({
      where: { id: target.id },
      data: { deleted: true, deletionScheduledAt: scheduled },
    });

    await writeSystemLog({
      action: "ADMIN_SOFT_DELETE_USER",
      targetUserId: target.id,
      targetEmail: target.email,
      metadata: {
        totalFiles: target._count.files,
        totalFolders: target._count.folders,
        storageUsedBytes: serializeStorageBytes(target.storageUsed),
        deletedBy: auth.user.email,
      },
    });

    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete user." };
  }
}

export async function restoreUserByAdminAction(targetUserId: string): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { success: false, error: auth.error };

  try {
    const target = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        deleted: true,
        _count: { select: { files: true, folders: true } },
        storageUsed: true,
      },
    });

    if (!target) return { success: false, error: "User not found." };
    if (!target.deleted) return { success: false, error: "User is already active." };

    await sendAdminAccountRestoredEmail({
      to: target.email,
      name: target.name,
    });

    await db.user.update({
      where: { id: target.id },
      data: { deleted: false, deletionScheduledAt: null },
    });

    await writeSystemLog({
      action: "ADMIN_RESTORE_USER",
      targetUserId: target.id,
      targetEmail: target.email,
      metadata: {
        totalFiles: target._count.files,
        totalFolders: target._count.folders,
        storageUsedBytes: serializeStorageBytes(target.storageUsed),
        deletedBy: auth.user.email,
      },
    });

    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to restore user." };
  }
}

export async function permanentDeleteUserByAdminAction(targetUserId: string): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { success: false, error: auth.error };

  if (auth.user.id === targetUserId) {
    return { success: false, error: "You cannot permanently delete your own account." };
  }

  try {
    const target = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        _count: { select: { files: true, folders: true } },
        storageUsed: true,
      },
    });

    if (!target) return { success: false, error: "User not found." };

    await sendAdminAccountPermanentlyDeletedEmail({
      to: target.email,
      name: target.name,
    });

    await db.user.delete({ where: { id: target.id } });

    await writeSystemLog({
      action: "ADMIN_PERMANENT_DELETE_USER",
      targetUserId: target.id,
      targetEmail: target.email,
      metadata: {
        targetName: target.name,
        totalFiles: target._count.files,
        totalFolders: target._count.folders,
        storageUsedBytes: serializeStorageBytes(target.storageUsed),
        deletedBy: auth.user.email,
      },
    });

    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to permanently delete user." };
  }
}

export async function logCleanupCronAction(metadata?: {
  totalFiles?: number;
  totalFolders?: number;
  storageUsedBytes?: bigint | number;
}) {
  const auth = await requireAdmin();
  if ("error" in auth) return { success: false, error: auth.error };

  try {
    await writeSystemLog({
      action: "CLEANUP_CRON",
      targetEmail: auth.user.email,
      metadata: {
        totalFiles: metadata?.totalFiles ?? 0,
        totalFolders: metadata?.totalFolders ?? 0,
        storageUsedBytes: serializeStorageBytes(metadata?.storageUsedBytes ?? 0),
        deletedBy: auth.user.email,
      },
    });
    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to write cleanup log." };
  }
}
