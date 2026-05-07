"use server";

import { db } from "@/lib/prisma";
import { loginSchema, signupSchema } from "@/lib/validations/auth";
import { hashPassword, comparePasswords, createSession, getSessionUser } from "@/lib/auth-help";
import { sendVerificationEmail } from "@/lib/email";
import {
  issueEmailVerificationToken,
  VERIFY_EMAIL_TTL_MINUTES,
} from "@/lib/email-verification";
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
      data: { requiresVerification: true },
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
  } catch (error) {
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

    return { success: true, message: "Verification email sent", status: 200 };
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
  } catch (error) {
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
  } catch (error) {
    return { success: false, message: "Failed to update preferences", status: 500 };
  }
}