import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import { buildShareLink } from "@/lib/share-link";
import { redirect } from "next/navigation";
import FilesClient from "./FilesClient";

type SearchParams = {
  folder?: string;
};

function buildBreadcrumbs(
  folderId: string | null,
  folderMap: Map<string, { id: string; name: string; parentId: string | null }>,
) {
  if (!folderId) return [] as Array<{ id: string; name: string }>;

  const trail: Array<{ id: string; name: string }> = [];
  const visited = new Set<string>();
  let currentId: string | null = folderId;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const folder = folderMap.get(currentId);
    if (!folder) break;
    trail.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  return trail;
}

function buildChildrenMap(
  folders: Array<{ id: string; parentId: string | null }>,
) {
  const map = new Map<string | null, string[]>();
  for (const folder of folders) {
    const key = folder.parentId ?? null;
    const entry = map.get(key) ?? [];
    entry.push(folder.id);
    map.set(key, entry);
  }
  return map;
}

function collectDescendants(
  rootId: string,
  childrenMap: Map<string | null, string[]>,
) {
  const stack = [rootId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const children = childrenMap.get(current) ?? [];
    for (const child of children) {
      if (!visited.has(child)) stack.push(child);
    }
  }

  return Array.from(visited);
}

function computeFolderSizes(
  folders: Array<{ id: string; parentId: string | null }>,
  childrenMap: Map<string | null, string[]>,
  files: Array<{ folderId: string | null; fileSize: number | null }>,
) {
  const directSize = new Map<string, number>();
  for (const file of files) {
    if (!file.folderId) continue;
    const current = directSize.get(file.folderId) ?? 0;
    directSize.set(file.folderId, current + (file.fileSize ?? 0));
  }

  const totalSize = new Map<string, number>();

  const resolve = (folderId: string): number => {
    if (totalSize.has(folderId)) return totalSize.get(folderId) as number;
    let sum = directSize.get(folderId) ?? 0;
    const children = childrenMap.get(folderId) ?? [];
    for (const child of children) {
      sum += resolve(child);
    }
    totalSize.set(folderId, sum);
    return sum;
  };

  for (const folder of folders) {
    resolve(folder.id);
  }

  return Object.fromEntries(totalSize.entries());
}

export default async function FilesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await Promise.resolve(searchParams);
  const currentFolderId =
    typeof params?.folder === "string" ? params.folder : null;

  const allFolders = (
    await db.folder.findMany({
      where: { userId: user.id, isDeleted: false, isTrashed: false },
      select: {
        id: true,
        name: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
        folderShares: { select: { token: true, expiresAt: true } },
      },
      orderBy: { name: "asc" },
    })
  ).map(({ folderShares, ...folder }) => ({
    ...folder,
    shareLink: folderShares?.[0]?.token ? buildShareLink(folderShares[0].token) : undefined,
    shareExpiresAt: folderShares?.[0]?.expiresAt ?? null,
    shared: Boolean(folderShares?.length),
  }));

  const folderMap = new Map(
    allFolders.map((folder) => [folder.id, folder]),
  );

  if (currentFolderId && !folderMap.has(currentFolderId)) {
    redirect("/dashboard/files");
  }

  const breadcrumbs = buildBreadcrumbs(currentFolderId, folderMap);
  const childrenMap = buildChildrenMap(allFolders);

  const fileSizeRows = await db.file.findMany({
    where: { userId: user.id, isDeleted: false, isTrashed: false },
    select: { folderId: true, fileSize: true },
  });

  const folderSizes = computeFolderSizes(
    allFolders,
    childrenMap,
    fileSizeRows,
  );

  const folderSummary = currentFolderId
    ? await (async () => {
        const currentFolder = folderMap.get(currentFolderId);
        if (!currentFolder) return null;

        const folderIds = collectDescendants(currentFolderId, childrenMap);
        const [fileAggregate, childFolderCount] = await Promise.all([
          db.file.aggregate({
            where: {
              userId: user.id,
              isDeleted: false,
              isTrashed: false,
              folderId: { in: folderIds },
            },
            _count: { _all: true },
            _sum: { fileSize: true },
          }),
          db.folder.count({
            where: {
              userId: user.id,
              isDeleted: false,
              isTrashed: false,
              id: { in: folderIds },
              NOT: { id: currentFolderId },
            },
          }),
        ]);

        return {
          id: currentFolder.id,
          name: currentFolder.name,
          fileCount: fileAggregate._count._all,
          folderCount: childFolderCount,
          totalSize: Number(fileAggregate._sum.fileSize ?? 0),
        };
      })()
    : null;

  const initialFiles = (
    await db.file.findMany({
      where: {
        userId: user.id,
        isDeleted: false,
        isTrashed: false,
        folderId: currentFolderId ?? null,
      },
      orderBy: { createdAt: "desc" },
      include: { shares: { select: { token: true, expiresAt: true } } },
    })
  ).map(({ shares, ...file }) => ({
    ...file,
    shareLink: shares?.[0]?.token ? buildShareLink(shares[0].token) : undefined,
    shared: Boolean(shares?.length),
    shareExpiresAt: shares?.[0]?.expiresAt ?? null,
  }));

  return (
    <FilesClient
      initialFiles={initialFiles}
      allFolders={allFolders}
      breadcrumbs={breadcrumbs}
      currentFolderId={currentFolderId}
      folderSummary={folderSummary}
      folderSizes={folderSizes}
    />
  );
}
