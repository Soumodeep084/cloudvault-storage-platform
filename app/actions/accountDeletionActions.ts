"use server";

import { db } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-help";
import { sendDeletionOtpEmail, sendDeletionScheduledEmail } from "@/lib/email";
import {
  ACCOUNT_DELETE_OTP_TTL_MINUTES,
  ACCOUNT_DELETE_RESEND_COOLDOWN_MINUTES,
  consumeAccountDeletionOtp,
  getDeletionScheduleDate,
  issueAccountDeletionOtp,
  validateAccountDeletionOtp,
} from "@/lib/account-deletion";
import { ActionResponse } from "@/types/auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function requestAccountDeletionOtpAction(): Promise<
  ActionResponse<{ retryAfterSeconds: number }>
> {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, message: "Unauthorized", status: 401 };
    if (user.deleted) {
      return { success: false, message: "Account already scheduled for deletion", status: 409 };
    }

    const otpResult = await issueAccountDeletionOtp(user.id);
    if (!otpResult.allowed) {
      return {
        success: false,
        message: "Please wait before requesting another code.",
        status: 429,
        data: { retryAfterSeconds: otpResult.retryAfterSeconds ?? 0 },
      };
    }

    await sendDeletionOtpEmail({
      to: user.email,
      name: user.name,
      otp: otpResult.otp,
      expiresInMinutes: ACCOUNT_DELETE_OTP_TTL_MINUTES,
    });

    return {
      success: true,
      message: "OTP sent",
      status: 200,
      data: { retryAfterSeconds: ACCOUNT_DELETE_RESEND_COOLDOWN_MINUTES * 60 },
    };
  } catch (error) {
    console.error("ACCOUNT_DELETE_OTP_ERROR:", error);
    return { success: false, message: "Failed to send OTP", status: 500 };
  }
}

export async function verifyAccountDeletionOtpAction(otp: string): Promise<ActionResponse> {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, message: "Unauthorized", status: 401 };
    if (user.deleted) {
      return { success: false, message: "Account already scheduled for deletion", status: 409 };
    }

    const normalizedOtp = otp.trim();
    if (!/^[0-9]{6}$/.test(normalizedOtp)) {
      return { success: false, message: "Enter a valid 6-digit code", status: 400 };
    }

    const validation = await validateAccountDeletionOtp(user.id, normalizedOtp);
    if (validation.status === "expired") {
      return { success: false, message: "OTP expired", status: 410 };
    }
    if (validation.status !== "valid") {
      return { success: false, message: "Invalid OTP", status: 400 };
    }

    return { success: true, message: "OTP verified", status: 200 };
  } catch (error) {
    console.error("ACCOUNT_DELETE_OTP_VERIFY_ERROR:", error);
    return { success: false, message: "Failed to verify OTP", status: 500 };
  }
}

export async function deleteAccountAction(payload: {
  otp: string;
  confirmationText: string;
  expectedText: string;
}): Promise<ActionResponse> {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, message: "Unauthorized", status: 401 };
    if (user.deleted) {
      return { success: false, message: "Account already scheduled for deletion", status: 409 };
    }

    const { otp, confirmationText, expectedText } = payload;
    if (confirmationText.trim() !== expectedText.trim()) {
      return { success: false, message: "Confirmation text does not match", status: 400 };
    }

    const normalizedOtp = otp.trim();
    if (!/^[0-9]{6}$/.test(normalizedOtp)) {
      return { success: false, message: "Enter a valid 6-digit code", status: 400 };
    }

    const validation = await consumeAccountDeletionOtp(user.id, normalizedOtp);
    if (validation.status === "expired") {
      return { success: false, message: "OTP expired", status: 410 };
    }
    if (validation.status !== "valid") {
      return { success: false, message: "Invalid OTP", status: 400 };
    }

    const scheduledFor = getDeletionScheduleDate();

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          deleted: true,
          deletionScheduledAt: scheduledFor,
        },
      }),
      db.session.deleteMany({ where: { userId: user.id } }),
      db.token.deleteMany({ where: { userId: user.id } }),
    ]);

    const cookieStore = await cookies();
    cookieStore.delete("auth_token");

    try {
      await sendDeletionScheduledEmail({
        to: user.email,
        name: user.name,
        scheduledFor,
      });
    } catch (error) {
      console.error("ACCOUNT_DELETE_EMAIL_ERROR:", error);
    }

    revalidatePath("/");
    return { success: true, message: "Account scheduled for deletion", status: 200 };
  } catch (error) {
    console.error("ACCOUNT_DELETE_ERROR:", error);
    return { success: false, message: "Failed to delete account", status: 500 };
  }
}
