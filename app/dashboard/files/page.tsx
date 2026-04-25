import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";
import FilesClient from "./FilesClient";

export default async function FilesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Fetch real files from Prisma for this user
  const initialFiles = (await db.file.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { shares: true },
  })).map(({ shares, ...file }) => ({
    ...file,
    shareLink: shares?.[0]?.shareLink,
    shared: Boolean(shares?.length),
  }));

  return <FilesClient initialFiles={initialFiles} />;
}
