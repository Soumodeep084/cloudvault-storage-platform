import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Download, Eye, ShieldCheck, LockKeyhole, Folder } from "lucide-react";
import { db } from "@/lib/prisma";
import { formatFileSize } from "@/lib/utils";
import bcrypt from "bcryptjs";
import {
  createPublicShareAccessCookieValue,
  getPublicShareAccessCookieName,
  isValidPublicShareAccessCookie,
} from "@/lib/public-share-access";
import { hashShareToken } from "@/lib/token-utils";
import { isRateLimited, bumpRateLimit, resetRateLimit } from "@/lib/rate-limit";

type FolderNode = {
  id: string;
  name: string;
  children: FolderNode[];
  files: Array<{
    id: string;
    fileName: string;
    fileType: string | null;
    fileSize: number | null;
  }>;
};

type SharedFileRecord = {
  id: string;
  password: string | null;
  file: {
    id: string;
    userId: string;
    fileName: string;
    fileUrl: string;
    fileType: string | null;
    fileSize: number | null;
    isDeleted: boolean;
  } | null;
};

type SharedFolderRecord = {
  id: string;
  password: string | null;
  folder: {
    id: string;
    userId: string;
    name: string;
    parentId: string | null;
    isDeleted: boolean;
    isTrashed: boolean;
  } | null;
};

type SharePasswordRecord = {
  id: string;
  password: string | null;
};

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

export default async function PublicSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }> | { token: string };
  searchParams?: Promise<{ error?: string }> | { error?: string };
}) {
  const { token } = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});

  const tokenHash = hashShareToken(token);
  let fileShare = (await db.share.findFirst({
    where: {
      token: tokenHash,
      isPublic: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      file: {
        select: {
          id: true,
          userId: true,
          fileName: true,
          fileUrl: true,
          fileType: true,
          fileSize: true,
          isDeleted: true,
        },
      },
    },
  })) as SharedFileRecord | null;

  let folderShare: SharedFolderRecord | null = fileShare
    ? null
    : (await db.folderShare.findFirst({
        where: {
          token: tokenHash,
          isPublic: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          folder: {
            select: {
              id: true,
              userId: true,
              name: true,
              parentId: true,
              isDeleted: true,
              isTrashed: true,
            },
          },
        },
        })) as SharedFolderRecord | null;

  if (!fileShare && !folderShare) {
    // Fallback: check for legacy plaintext tokens so existing links continue to work.
    const legacyFile = await db.share.findFirst({
      where: { token, isPublic: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { file: { select: { id: true, userId: true, fileName: true, fileUrl: true, fileType: true, fileSize: true, isDeleted: true } } },
    }) as SharedFileRecord | null;

    if (legacyFile) {
      fileShare = legacyFile;
    } else {
      const legacyFolder = await db.folderShare.findFirst({
        where: { token, isPublic: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        include: { folder: { select: { id: true, userId: true, name: true, parentId: true, isDeleted: true, isTrashed: true } } },
      }) as SharedFolderRecord | null;

      if (legacyFolder) {
        folderShare = legacyFolder;
      }
    }

    if (!fileShare && !folderShare) {
      notFound();
    }
  }

  if (fileShare && (!fileShare.file || fileShare.file.isDeleted)) {
    notFound();
  }

  if (folderShare && (!folderShare.folder || folderShare.folder.isDeleted || folderShare.folder.isTrashed)) {
    notFound();
  }

  const shareId = fileShare?.id ?? folderShare?.id ?? "";
  const sharePassword = fileShare?.password ?? folderShare?.password ?? null;
  const shareLabel = fileShare ? "file" : "folder";
  const shareName = fileShare?.file?.fileName ?? folderShare?.folder?.name ?? "";

  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(getPublicShareAccessCookieName(shareId))?.value;
  const hasAccess = !sharePassword || isValidPublicShareAccessCookie(shareId, accessCookie);

  async function unlockSharedResource(formData: FormData) {
    "use server";

    const passwordInput = String(formData.get("password") ?? "").trim();
    let latestShare: SharePasswordRecord | null = fileShare
      ? (await db.share.findFirst({
          where: {
            token: tokenHash,
            isPublic: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: {
            id: true,
            password: true,
          },
        })) as SharePasswordRecord | null
      : (await db.folderShare.findFirst({
          where: {
            token: tokenHash,
            isPublic: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: {
            id: true,
            password: true,
          },
        })) as SharePasswordRecord | null;
    let latestShareIsLegacyPlaintext = false;

    if (!latestShare) {
      // Try plaintext fallback for migration-on-access
      const legacyLatest = fileShare
        ? (await db.share.findFirst({ where: { token, isPublic: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true, password: true } })) as SharePasswordRecord | null
        : (await db.folderShare.findFirst({ where: { token, isPublic: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true, password: true } })) as SharePasswordRecord | null;

      if (!legacyLatest) {
        redirect(`/s/${token}?error=invalid-link`);
      }

      // Replace latestShare with legacy record and mark for migration
      latestShare = legacyLatest;
      latestShareIsLegacyPlaintext = true;
    }

    if (!latestShare!.password) {
      redirect(`/s/${token}`);
    }

    // Server-side rate limiting keyed by share id
    const rlKey = `share:${latestShare!.id}`;
    const rateState = isRateLimited(rlKey);
    if (rateState.limited) {
      redirect(`/s/${token}?error=rate-limited`);
    }

    const valid = await bcrypt.compare(passwordInput, latestShare!.password);
    if (!valid) {
      bumpRateLimit(rlKey);
      redirect(`/s/${token}?error=invalid-password`);
    }

    // reset attempts on success
    resetRateLimit(rlKey);
    const actionCookieStore = await cookies();
    actionCookieStore.set(
      getPublicShareAccessCookieName(latestShare!.id),
      createPublicShareAccessCookieValue(latestShare!.id),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24,
        path: "/",
      },
    );

    // If the share was stored as plaintext token, migrate it now to the hashed token
    if (latestShareIsLegacyPlaintext) {
      try {
        if (fileShare) {
          await db.share.update({ where: { id: latestShare!.id }, data: { token: hashShareToken(token) } });
        } else {
          await db.folderShare.update({ where: { id: latestShare!.id }, data: { token: hashShareToken(token) } });
        }
      } catch {
        // ignore migration errors
      }
    }

    redirect(`/s/${token}`);
  }

  if (!hasAccess) {
    const errorMessage = resolvedSearchParams.error === "invalid-password"
      ? "Incorrect password. Please try again."
      : resolvedSearchParams.error === "rate-limited"
        ? "Too many attempts. Please wait and try again."
      : resolvedSearchParams.error === "auth-required"
        ? `Please enter the password to access this ${shareLabel}.`
        : null;

    return (
      <main className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-100 px-4 py-8 sm:px-6 sm:py-14">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Protected Shared {shareLabel === "file" ? "File" : "Folder"}</h1>
              <p className="mt-1 text-sm text-slate-600">
                Enter the password shared by the sender to preview or download this {shareLabel}.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{shareLabel}</p>
            <p className="mt-1 break-all text-base font-semibold text-slate-900">{shareName}</p>
          </div>

          <form action={unlockSharedResource} className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">Access password</label>
            <input
              type="password"
              name="password"
              required
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              placeholder="Enter password"
            />

            {errorMessage && (
              <p className="text-sm text-rose-600">{errorMessage}</p>
            )}

            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Unlock {shareLabel}
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (fileShare && fileShare.file) {
    return (
    <main className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-100 px-4 py-8 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-5 flex items-start gap-3 sm:mb-6">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Shared File Access</h1>
            <p className="mt-1 text-sm text-slate-600">
              This file was securely shared with you. You can preview it or download it directly.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">File</p>
          <p className="mt-1 break-all text-base font-semibold text-slate-900 sm:text-lg">{fileShare.file.fileName}</p>
          <p className="mt-1 text-sm text-slate-600">
            {fileShare.file.fileType || "Unknown type"}
            {typeof fileShare.file.fileSize === "number" ? ` • ${fileShare.file.fileSize} bytes` : ""}
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:mt-6 sm:grid-cols-2">
          <a
            href={`/api/public-share/${encodeURIComponent(token)}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
            Preview File
          </a>

          <a
            href={`/api/public-share/${encodeURIComponent(token)}/download`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Download File
          </a>
        </div>
      </div>
    </main>
    );
  }

  if (!folderShare || !folderShare.folder) {
    notFound();
  }

  const allFolders = await db.folder.findMany({
    where: { userId: folderShare.folder.userId, isDeleted: false, isTrashed: false },
    select: { id: true, parentId: true, name: true },
  });

  const childrenMap = buildChildrenMap(allFolders);
  const folderIds = new Set(collectDescendants(folderShare.folder.id, childrenMap));
  const nodeMap = new Map<string, FolderNode>();
  for (const folder of allFolders) {
    if (!folderIds.has(folder.id)) continue;
    nodeMap.set(folder.id, {
      id: folder.id,
      name: folder.name,
      children: [],
      files: [],
    });
  }

  for (const folder of allFolders) {
    if (!folderIds.has(folder.id)) continue;
    if (!folder.parentId) continue;
    const parentNode = nodeMap.get(folder.parentId);
    const node = nodeMap.get(folder.id);
    if (parentNode && node) {
      parentNode.children.push(node);
    }
  }

  const files = await db.file.findMany({
    where: {
      userId: folderShare.folder.userId,
      isDeleted: false,
      isTrashed: false,
      folderId: { in: Array.from(folderIds) },
    },
    select: { id: true, fileName: true, fileType: true, fileSize: true, folderId: true },
    orderBy: { fileName: "asc" },
  });

  for (const file of files) {
    if (!file.folderId) continue;
    const node = nodeMap.get(file.folderId);
    if (!node) continue;
    node.files.push({
      id: file.id,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
    });
  }

  const rootNode = nodeMap.get(folderShare.folder.id);

  const renderFolder = (node: FolderNode, depth = 0) => (
    <div key={node.id} className={depth === 0 ? "" : "mt-4"}>
      <div className="flex items-center gap-2">
        <div className="rounded-full bg-slate-100 p-2 text-slate-700">
          <Folder className="h-4 w-4" />
        </div>
        <p className="text-sm font-semibold text-slate-900">{node.name}</p>
      </div>

      {node.files.length > 0 && (
        <div className="mt-3 space-y-2">
          {node.files.map((file) => (
            <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{file.fileName}</p>
                <p className="text-xs text-slate-500">
                  {file.fileType || "Unknown type"}
                  {typeof file.fileSize === "number" ? ` • ${formatFileSize(file.fileSize)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/public-share/${encodeURIComponent(token)}/preview?fileId=${encodeURIComponent(file.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </a>
                <a
                  href={`/api/public-share/${encodeURIComponent(token)}/download?fileId=${encodeURIComponent(file.id)}`}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition-colors hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {node.children.length > 0 && (
        <div className="mt-4 space-y-4 border-l border-slate-200 pl-4">
          {node.children.map((child) => renderFolder(child, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-100 px-4 py-8 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-5 flex items-start gap-3 sm:mb-6">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Shared Folder Access</h1>
            <p className="mt-1 text-sm text-slate-600">
              This folder was securely shared with you. Browse and download files from the full hierarchy.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Folder</p>
          <p className="mt-1 break-all text-base font-semibold text-slate-900 sm:text-lg">
            {folderShare.folder.name}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href={`/api/public-share/${encodeURIComponent(token)}/download?zip=1`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Download folder (.zip)
          </a>
          <p className="text-xs text-slate-500">
            For large folders, this may take a few minutes to prepare.
          </p>
        </div>

        <div className="mt-6">
          {rootNode ? (
            renderFolder(rootNode)
          ) : (
            <p className="text-sm text-slate-500">No files available in this folder.</p>
          )}
        </div>
      </div>
    </main>
  );
}
