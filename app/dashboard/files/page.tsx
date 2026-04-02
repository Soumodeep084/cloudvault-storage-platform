import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";
import FilesClient from "./FilesClient";
import { mockFiles } from "@/lib/mock-data";

export default async function FilesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Fetch real files from Prisma for this user
//   const initialFiles = await db.file.findMany({
//     where: { userId: user.id },
//     orderBy: { createdAt: "desc" },
//   });

// Using Mock Data now
    const initialFiles = mockFiles

  return <FilesClient initialFiles={initialFiles} />;
}
