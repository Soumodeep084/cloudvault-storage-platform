import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const activities = await db.activityLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return <HistoryClient initialActivities={activities} />;
}
