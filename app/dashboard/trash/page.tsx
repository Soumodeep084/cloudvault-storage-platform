import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import TrashClient from "./TrashClient";
import { purgeExpiredTrashAction } from "@/app/actions/trashActions";

const TRASH_RETENTION_DAYS = 30;

export default async function TrashPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  await purgeExpiredTrashAction();

  const trashedFolders = await db.folder.findMany({
    where: { userId: user.id, isDeleted: false, isTrashed: true },
    select: { id: true, name: true, parentId: true, trashedDate: true },
    orderBy: { trashedDate: "desc" },
  });

  const trashedFolderIds = new Set(trashedFolders.map((folder) => folder.id));

  const trashedFiles = await db.file.findMany({
    where: { userId: user.id, isDeleted: false, isTrashed: true },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      fileType: true,
      folderId: true,
      trashedDate: true,
    },
    orderBy: { trashedDate: "desc" },
  });

  const visibleFolders = trashedFolders.filter(
    (folder) => !folder.parentId || !trashedFolderIds.has(folder.parentId),
  );

  const visibleFiles = trashedFiles.filter(
    (file) => !file.folderId || !trashedFolderIds.has(file.folderId),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trash</h1>
        <p className="text-sm text-muted-foreground">
          Items stay in trash for {TRASH_RETENTION_DAYS} days before permanent removal.
        </p>
      </div>
      <TrashClient
        files={visibleFiles.map((file) => ({
          id: file.id,
          fileName: file.fileName,
          fileSize: file.fileSize,
          fileType: file.fileType,
          folderId: file.folderId,
          trashedDate: file.trashedDate,
        }))}
        folders={visibleFolders.map((folder) => ({
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId,
          trashedDate: folder.trashedDate,
        }))}
        retentionDays={TRASH_RETENTION_DAYS}
      />
    </div>
  );
}
