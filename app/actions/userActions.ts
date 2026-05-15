"use server";

import { db } from "@/lib/prisma";
import { loginSchema, signupSchema } from "@/lib/validations/auth";
import { hashPassword, comparePasswords, createSession, getSessionUser } from "@/lib/auth-help";
import { sendDeletionOtpEmail, sendDeletionScheduledEmail, sendVerificationEmail } from "@/lib/email";
import {
  issueEmailVerificationToken,
  VERIFY_EMAIL_TTL_MINUTES,
  VERIFY_EMAIL_RESEND_COOLDOWN_MINUTES,
} from "@/lib/email-verification";
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
import { z } from "zod";

type SignupInput = z.infer<typeof signupSchema>;
type LoginInput = z.infer<typeof loginSchema>;

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

async function sendVerifyEmail(user: { id: string; email: string; name?: string | null }) {
  const tokenResult = await issueEmailVerificationToken(user.id, { bypassCooldown: true });
  if (!tokenResult.allowed || !tokenResult.token) return;

  const verifyUrl = `${getAppBaseUrl()}/api/auth/verify-email?token=${tokenResult.token}`;
  await sendVerificationEmail({
    to: user.email,
    name: user.name,
    verifyUrl,
    expiresInMinutes: VERIFY_EMAIL_TTL_MINUTES,
  });
}

// Status Codes: 201 (Created), 400 (Bad Request), 409 (Conflict), 500 (Server Error)
export async function signUpAction(values: SignupInput): Promise<ActionResponse> {
  try {
    const validated = signupSchema.safeParse(values);
    
    if (!validated.success) {
      return {
        success: false,
        message: "Validation failed",
        status: 400,
        errors: validated.error.flatten().fieldErrors,
      };
    }

    const { email, password, name } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedName = name.trim();

    const existingUser = await db.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });
    if (existingUser) {
      return { success: false, message: "User already exists", status: 409 };
    }

    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: { email: normalizedEmail, name: normalizedName, password: hashedPassword },
    });

    try {
      await sendVerifyEmail(user);
    } catch (error) {
      console.error("VERIFY_EMAIL_SEND_ERROR:", error);
    }

    await createSession(user.id);

    return {
      success: true,
      message: "Account created. Please verify your email.",
      status: 201,
      data: {
        requiresVerification: true,
        retryAfterSeconds: VERIFY_EMAIL_RESEND_COOLDOWN_MINUTES * 60,
      },
    };
  } catch (error) {
    // Handles race conditions where two signup requests hit at the same time.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { success: false, message: "User already exists", status: 409 };
    }

    console.error("SIGNUP_ERROR:", error);
    return { success: false, message: "Internal Server Error", status: 500 };
  }
}

// Status Codes: 200 (OK), 401 (Unauthorized), 500 (Server Error)
export async function loginAction(values: LoginInput): Promise<ActionResponse> {
  try {
    const validated = loginSchema.safeParse(values);
    if (!validated.success) {
      return { success: false, message: "Invalid input", status: 400 };
    }

    const normalizedEmail = validated.data.email.toLowerCase().trim();

    const user = await db.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });
    if (!user) {
      return { success: false, message: "Invalid credentials", status: 401 };
    }

    if (user.deleted) {
      const cookieStore = await cookies();
      if (user.deletionScheduledAt) {
        cookieStore.set("account_deletion_scheduled_at", user.deletionScheduledAt.toISOString(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 5,
          path: "/account-deleted",
        });
      }
      return {
        success: false,
        message: "Account scheduled for deletion. Contact support to recover.",
        status: 403,
        data: { deleted: true },
      };
    }

    const isMatch = await comparePasswords(validated.data.password, user.password);
    if (!isMatch) {
      return { success: false, message: "Invalid credentials", status: 401 };
    }

    if (!user.isVerified) {
      await createSession(user.id);
      try {
        const tokenResult = await issueEmailVerificationToken(user.id);
        if (tokenResult.allowed && tokenResult.token) {
          const verifyUrl = `${getAppBaseUrl()}/api/auth/verify-email?token=${tokenResult.token}`;
          await sendVerificationEmail({
            to: user.email,
            name: user.name,
            verifyUrl,
            expiresInMinutes: VERIFY_EMAIL_TTL_MINUTES,
          });
        }
      } catch (error) {
        console.error("VERIFY_EMAIL_RESEND_ERROR:", error);
      }

      return {
        success: false,
        message: "Email not verified",
        status: 403,
        data: { requiresVerification: true },
      };
    }

    await createSession(user.id);

    return { 
      success: true, 
      message: "Login successful", 
      status: 200,
      data: { user: { email: user.email, name: user.name } } 
    };
  } catch {
    return { success: false, message: "Internal Server Error", status: 500 };
  }
}

export async function resendVerificationEmailAction(): Promise<ActionResponse> {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, message: "Unauthorized", status: 401 };
    if (user.isVerified) {
      return { success: false, message: "Email already verified", status: 409 };
    }

    const tokenResult = await issueEmailVerificationToken(user.id);
    if (!tokenResult.allowed) {
      return {
        success: false,
        message: "Verification email was sent recently. Try again soon.",
        status: 429,
        data: { retryAfterSeconds: tokenResult.retryAfterSeconds ?? 0 },
      };
    }

    const verifyUrl = `${getAppBaseUrl()}/api/auth/verify-email?token=${tokenResult.token}`;
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl,
      expiresInMinutes: VERIFY_EMAIL_TTL_MINUTES,
    });

    return {
      success: true,
      message: "Verification email sent",
      status: 200,
      data: { retryAfterSeconds: VERIFY_EMAIL_RESEND_COOLDOWN_MINUTES * 60 },
    };
  } catch (error) {
    console.error("RESEND_VERIFY_EMAIL_ERROR:", error);
    return { success: false, message: "Failed to send email", status: 500 };
  }
}

// Status Codes: 200 (OK)
export async function logoutAction(): Promise<ActionResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (token) {
    await db.session.deleteMany({ where: { token } });
  }

  cookieStore.delete("auth_token");
  revalidatePath("/");
  
  return { success: true, message: "Logged out successfully", status: 200 };
}

export async function updateProfileAction(formData: FormData): Promise<ActionResponse> {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, message: "Unauthorized", status: 401 };

    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return { success: false, message: "Name is required", status: 400 };
    }

    await db.user.update({
      where: { id: user.id },
      data: { name },
    });

    revalidatePath("/dashboard/settings");
    return { success: true, message: "Profile updated", status: 200 };
  } catch {
    return { success: false, message: "Failed to update profile", status: 500 };
  }
}

export async function updatePreferencesAction(formData: FormData): Promise<ActionResponse> {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, message: "Unauthorized", status: 401 };

    const emailNotifications = formData.get("emailNotifications") === "on";
    const twoFactorEnabled = formData.get("twoFactorEnabled") === "on";

    await db.user.update({
      where: { id: user.id },
      data: {
        emailNotifications,
        twoFactorEnabled,
      },
    });

    revalidatePath("/dashboard/settings");
    return { success: true, message: "Preferences updated", status: 200 };
  } catch {
    return { success: false, message: "Failed to update preferences", status: 500 };
  }
}

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