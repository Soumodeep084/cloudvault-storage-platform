"use server";

import { db } from "@/lib/prisma";
import { TokenType } from "@prisma/client";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "@/lib/validations/auth";
import { comparePasswords, createSession, getSessionUser, hashPassword } from "@/lib/auth-help";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import {
  issueEmailVerificationToken,
  VERIFY_EMAIL_TTL_MINUTES,
  VERIFY_EMAIL_RESEND_COOLDOWN_MINUTES,
} from "@/lib/email-verification";
import {
  issuePasswordResetToken,
  RESET_PASSWORD_TTL_MINUTES,
  validatePasswordResetToken,
} from "@/lib/password-reset";
import { ActionResponse } from "@/types/auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type SignupInput = z.infer<typeof signupSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

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
      data: { user: { email: user.email, name: user.name } },
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

// Status Codes: 200 (OK), 400 (Bad Request)
export async function requestPasswordResetAction(
  values: ForgotPasswordInput,
): Promise<ActionResponse> {
  try {
    const validated = forgotPasswordSchema.safeParse(values);
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

    if (!user || user.deleted) {
      return {
        success: false,
        message: "This email is not registered.",
        status: 404,
      };
    }

    const tokenResult = await issuePasswordResetToken(user.id);
    if (tokenResult.allowed && tokenResult.token) {
      const resetUrl = `${getAppBaseUrl()}/reset-password?token=${tokenResult.token}`;
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes: RESET_PASSWORD_TTL_MINUTES,
      });
    }

    return {
      success: true,
      message: "Check your email for a reset link.",
      status: 200,
    };
  } catch (error) {
    console.error("REQUEST_PASSWORD_RESET_ERROR:", error);
    return { success: false, message: "Failed to send reset email", status: 500 };
  }
}

// Status Codes: 200 (OK), 400 (Bad Request), 403 (Forbidden), 410 (Gone)
export async function resetPasswordAction(values: ResetPasswordInput): Promise<ActionResponse> {
  try {
    const validated = resetPasswordSchema.safeParse(values);
    if (!validated.success) {
      return {
        success: false,
        message: "Validation failed",
        status: 400,
        errors: validated.error.flatten().fieldErrors,
      };
    }

    const { token, password } = validated.data;
    const tokenResult = await validatePasswordResetToken(token);

    if (tokenResult.status === "not_found") {
      return { success: false, message: "Invalid reset link", status: 400 };
    }

    if (tokenResult.status === "expired") {
      return { success: false, message: "Reset link expired", status: 410 };
    }

    const user = await db.user.findUnique({
      where: { id: tokenResult.userId },
      select: { id: true, deleted: true },
    });

    if (!user || user.deleted) {
      return { success: false, message: "Account unavailable", status: 403 };
    }

    const hashedPassword = await hashPassword(password);

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      db.token.deleteMany({
        where: { userId: user.id, type: TokenType.RESET_PASSWORD },
      }),
      db.session.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return { success: true, message: "Password reset successful", status: 200 };
  } catch (error) {
    console.error("RESET_PASSWORD_ERROR:", error);
    return { success: false, message: "Failed to reset password", status: 500 };
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
