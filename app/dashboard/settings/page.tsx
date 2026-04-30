import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-help";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isVerified: true,
      storageUsed: true,
      createdAt: true,
    },
  });

  if (!user) redirect("/login");

  return <SettingsClient user={user} />;
}
