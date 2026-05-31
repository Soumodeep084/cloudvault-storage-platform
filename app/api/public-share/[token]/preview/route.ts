import { NextRequest, NextResponse } from "next/server";
import { redirectToStorageObject } from "@/lib/storage-delivery";
import {
  getPublicShareAccessCookieName,
  isValidPublicShareAccessCookie,
} from "@/lib/public-share-access";
import { isRateLimited, bumpRateLimit } from "@/lib/rate-limit";
import {
  migratePublicShareToken,
  resolvePublicShareByToken,
} from "@/lib/public-share-service";
import { db } from "@/lib/prisma";
import { isDescendantFolder } from "@/lib/folder-tree";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> | { token: string } },
) {
  const { token } = await Promise.resolve(params);

  const resolvedShare = await resolvePublicShareByToken(token);

  if (resolvedShare?.kind === "file") {
    const { share: resolvedFileShare, isLegacy, tokenHash } = resolvedShare;
    const rlKey = `share:${resolvedFileShare.id}`;
    if (isRateLimited(rlKey).limited) {
      return NextResponse.json({ message: "Too many attempts" }, { status: 429 });
    }
    if (!resolvedFileShare.file || resolvedFileShare.file.isDeleted) {
      return NextResponse.json({ message: `File missing or deleted for file share ${resolvedFileShare.id}` }, { status: 404 });
    }

    if (resolvedFileShare.password) {
      const accessCookie = request.cookies.get(getPublicShareAccessCookieName(resolvedFileShare.id))?.value;
      if (!isValidPublicShareAccessCookie(resolvedFileShare.id, accessCookie)) {
        bumpRateLimit(rlKey);
        return NextResponse.redirect(new URL(`/s/${token}?error=auth-required`, request.url));
      }
    }

    if (isLegacy) {
      try {
        await migratePublicShareToken("file", resolvedFileShare.id, tokenHash);
      } catch {
        // ignore migration errors (unique constraint, race conditions)
      }
    }

    return redirectToStorageObject({
      fileUrl: resolvedFileShare.file.fileUrl,
      fileName: resolvedFileShare.file.fileName,
    });
  }

  if (resolvedShare?.kind !== "folder") {
    return NextResponse.json({ message: `Share not found for token ${token}` }, { status: 404 });
  }

  const { share: folderShare, isLegacy, tokenHash } = resolvedShare;
  if (!folderShare.folder || folderShare.folder.isDeleted || folderShare.folder.isTrashed) {
    return NextResponse.json({ message: `Share not found for token ${token}` }, { status: 404 });
  }

  if (folderShare.password) {
    const rlKey = `share:${folderShare.id}`;
    if (isRateLimited(rlKey).limited) {
      return NextResponse.json({ message: "Too many attempts" }, { status: 429 });
    }
    const accessCookie = request.cookies.get(getPublicShareAccessCookieName(folderShare.id))?.value;
    if (!isValidPublicShareAccessCookie(folderShare.id, accessCookie)) {
      bumpRateLimit(rlKey);
      return NextResponse.redirect(new URL(`/s/${token}?error=auth-required`, request.url));
    }
  }

  if (isLegacy) {
    try {
      await migratePublicShareToken("folder", folderShare.id, tokenHash);
    } catch {
      // ignore migration errors
    }
  }

  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.redirect(new URL(`/s/${token}`, request.url));
  }

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId: folderShare.folder.userId,
      isDeleted: false,
      isTrashed: false,
    },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      fileType: true,
      folderId: true,
    },
  });

  if (!file) {
    return NextResponse.json({ message: `File ${fileId} not found for folder share ${folderShare.id}` }, { status: 404 });
  }

  const folderRows = await db.folder.findMany({
    where: { userId: folderShare.folder.userId, isDeleted: false, isTrashed: false },
    select: { id: true, parentId: true },
  });
  const parentMap = new Map(folderRows.map((row) => [row.id, row.parentId]));

  if (!isDescendantFolder(file.folderId ?? null, folderShare.folder.id, parentMap)) {
    return NextResponse.json({ message: `File ${fileId} is not a descendant of shared folder ${folderShare.folder.id}` }, { status: 404 });
  }

  return redirectToStorageObject({
    fileUrl: file.fileUrl,
    fileName: file.fileName,
  });
}
