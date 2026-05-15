"use server";

import { db } from "@/lib/prisma";
import { comparePasswords } from "@/lib/auth-help";
import { sendRestoreOtpEmail } from "@/lib/email";
import {
  ACCOUNT_RESTORE_OTP_TTL_MINUTES,
  ACCOUNT_RESTORE_RESEND_COOLDOWN_SECONDS,
  consumeAccountRestoreOtp,
  issueAccountRestoreOtp,
  validateAccountRestoreOtp,
} from "@/lib/account-restore";
import { ActionResponse } from "@/types/auth";
import { TokenType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function requestAccountRestoreOtpAction(email: string): Promise<
  ActionResponse<{ retryAfterSeconds?: number }>
> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (!z.string().email().safeParse(normalizedEmail).success) {
      return { success: false, message: "Enter a valid email", status: 400 };
    }

    const user = await db.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        deleted: true,
        deletionScheduledAt: true,
      },
    });

    if (!user) {
      return { success: false, message: "Account not found", status: 404 };
    }

    if (!user.deleted || !user.deletionScheduledAt) {
      return {
        success: false,
        message: "Account is not scheduled for deletion",
        status: 409,
      };
    }

    if (user.deletionScheduledAt <= new Date()) {
      return {
        success: false,
        message: "Restore window has expired",
        status: 410,
      };
    }

    const otpResult = await issueAccountRestoreOtp(user.id);
    if (!otpResult.allowed) {
      return {
        success: false,
        message: "Please wait before requesting another code.",
        status: 429,
        data: { retryAfterSeconds: otpResult.retryAfterSeconds ?? 0 },
      };
    }

    await sendRestoreOtpEmail({
      to: user.email,
      name: user.name,
      otp: otpResult.otp,
      expiresInMinutes: ACCOUNT_RESTORE_OTP_TTL_MINUTES,
    });

    return {
      success: true,
      message: "OTP sent",
      status: 200,
      data: { retryAfterSeconds: ACCOUNT_RESTORE_RESEND_COOLDOWN_SECONDS },
    };
  } catch (error) {
    console.error("ACCOUNT_RESTORE_OTP_ERROR:", error);
    return { success: false, message: "Failed to send OTP", status: 500 };
  }
}

export async function verifyAccountRestoreOtpAction(
  email: string,
  otp: string,
): Promise<ActionResponse<{ remainingAttempts?: number }>> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (!z.string().email().safeParse(normalizedEmail).success) {
      return { success: false, message: "Enter a valid email", status: 400 };
    }

    const user = await db.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        deleted: true,
        deletionScheduledAt: true,
      },
    });

    if (!user) {
      return { success: false, message: "Account not found", status: 404 };
    }

    if (!user.deleted || !user.deletionScheduledAt) {
      return {
        success: false,
        message: "Account is not scheduled for deletion",
        status: 409,
      };
    }

    if (user.deletionScheduledAt <= new Date()) {
      return {
        success: false,
        message: "Restore window has expired",
        status: 410,
      };
    }

    const normalizedOtp = otp.trim();
    if (!/^[0-9]{6}$/.test(normalizedOtp)) {
      return { success: false, message: "Enter a valid 6-digit code", status: 400 };
    }

    const validation = await validateAccountRestoreOtp(user.id, normalizedOtp);
    if (validation.status === "expired") {
      return { success: false, message: "OTP expired", status: 410 };
    }
    if (validation.status === "locked") {
      return { success: false, message: "Too many attempts. Request a new code.", status: 423 };
    }
    if (validation.status !== "valid") {
      return {
        success: false,
        message: "Invalid OTP",
        status: 400,
        data: {
          remainingAttempts: validation.remainingAttempts,
        },
      };
    }

    return { success: true, message: "OTP verified", status: 200 };
  } catch (error) {
    console.error("ACCOUNT_RESTORE_OTP_VERIFY_ERROR:", error);
    return { success: false, message: "Failed to verify OTP", status: 500 };
  }
}

export async function restoreAccountAction(payload: {
  email: string;
  otp: string;
  password: string;
}): Promise<ActionResponse> {
  try {
    const normalizedEmail = payload.email.trim().toLowerCase();
    if (!z.string().email().safeParse(normalizedEmail).success) {
      return { success: false, message: "Enter a valid email", status: 400 };
    }

    if (!payload.password.trim()) {
      return { success: false, message: "Password is required", status: 400 };
    }

    const user = await db.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        password: true,
        deleted: true,
        deletionScheduledAt: true,
      },
    });

    if (!user) {
      return { success: false, message: "Account not found", status: 404 };
    }

    if (!user.deleted || !user.deletionScheduledAt) {
      return {
        success: false,
        message: "Account is not scheduled for deletion",
        status: 409,
      };
    }

    if (user.deletionScheduledAt <= new Date()) {
      return {
        success: false,
        message: "Restore window has expired",
        status: 410,
      };
    }

    const normalizedOtp = payload.otp.trim();
    if (!/^[0-9]{6}$/.test(normalizedOtp)) {
      return { success: false, message: "Enter a valid 6-digit code", status: 400 };
    }

    const validation = await consumeAccountRestoreOtp(user.id, normalizedOtp);
    if (validation.status === "expired") {
      return { success: false, message: "OTP expired", status: 410 };
    }
    if (validation.status === "locked") {
      return { success: false, message: "Too many attempts. Request a new code.", status: 423 };
    }
    if (validation.status !== "valid") {
      return { success: false, message: "Invalid OTP", status: 400 };
    }

    const passwordOk = await comparePasswords(payload.password, user.password);
    if (!passwordOk) {
      return { success: false, message: "Incorrect password", status: 401 };
    }

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          deleted: false,
          deletionScheduledAt: null,
        },
      }),
      db.token.deleteMany({
        where: { userId: user.id, type: TokenType.ACCOUNT_RESTORE_OTP },
      }),
    ]);

    revalidatePath("/");
    return { success: true, message: "Account restored", status: 200 };
  } catch (error) {
    console.error("ACCOUNT_RESTORE_ERROR:", error);
    return { success: false, message: "Failed to restore account", status: 500 };
  }
}
