"use server";

import { db } from "@/lib/prisma";
import { loginSchema, signupSchema } from "@/lib/validations/auth";
import { hashPassword, comparePasswords, createSession } from "@/lib/auth-help";
import { ActionResponse } from "@/types/auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type SignupInput = z.infer<typeof signupSchema>;
type LoginInput = z.infer<typeof loginSchema>;

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

    await createSession(user.id);

    return { success: true, message: "Account created", status: 201 };
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