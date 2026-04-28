import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-help";
import SharedClient from "./SharedClient";

export default async function SharedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const shares = await db.share.findMany({
    where: {
      userId: user.id,
      file: { isDeleted: false },
    },
    include: {
      file: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const sharedFiles = shares.map((share) => ({
    id: share.id,
    fileId: share.fileId,
    fileName: share.file.fileName,
    fileSize: share.file.fileSize ?? 0,
    fileType: share.file.fileType,
    updatedAt: share.file.updatedAt,
    shareLink: share.shareLink,
    expiresAt: share.expiresAt,
    sharedAt: share.createdAt,
  }));

  return <SharedClient initialShares={sharedFiles} />;
}
