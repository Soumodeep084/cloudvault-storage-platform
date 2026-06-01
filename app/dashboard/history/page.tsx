import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const activities = await db.activity.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      file: {
        select: {
          id: true,
          fileName: true,
          folderId: true,
        },
      },
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 200,
  });

  return <HistoryClient initialActivities={activities} />;
}
