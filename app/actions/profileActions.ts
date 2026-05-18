"use server";

import { db } from "@/lib/prisma";
import { comparePasswords, getSessionUser, hashPassword } from "@/lib/auth-help";
import { changePasswordSchema } from "@/lib/validations/auth";
import { ActionResponse } from "@/types/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

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

// Status Codes: 200 (OK), 400 (Bad Request), 401 (Unauthorized)
export async function changePasswordAction(values: ChangePasswordInput): Promise<ActionResponse> {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, message: "Unauthorized", status: 401 };

    const validated = changePasswordSchema.safeParse(values);
    if (!validated.success) {
      return {
        success: false,
        message: "Validation failed",
        status: 400,
        errors: validated.error.flatten().fieldErrors,
      };
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, password: true },
    });

    if (!dbUser) {
      return { success: false, message: "Unauthorized", status: 401 };
    }

    const isMatch = await comparePasswords(validated.data.currentPassword, dbUser.password);
    if (!isMatch) {
      return { success: false, message: "Current password is incorrect", status: 400 };
    }

    const hashedPassword = await hashPassword(validated.data.newPassword);

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);

    revalidatePath("/dashboard/settings");
    return { success: true, message: "Password updated", status: 200 };
  } catch {
    return { success: false, message: "Failed to update password", status: 500 };
  }
}

/*
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
*/
