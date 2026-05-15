"use server";

import { db } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-help";
import { ActionResponse } from "@/types/auth";
import { revalidatePath } from "next/cache";

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
