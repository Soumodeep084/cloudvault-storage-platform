import { db } from "@/lib/prisma";
import { buildShareLink } from "@/lib/share-link";
import { createRandomToken, hashShareToken } from "@/lib/token-utils";
import {
  SHARE_MAX_EXPIRY_MINUTES,
  SHARE_PASSWORD_MIN_LENGTH,
} from "@/lib/share-constraints";

const FILE_SHARE_SELECT = {
  id: true,
  userId: true,
  password: true,
  file: {
    select: {
      id: true,
      userId: true,
      fileName: true,
      fileUrl: true,
      fileType: true,
      fileSize: true,
      isDeleted: true,
      isTrashed: true,
    },
  },
} as const;

const FOLDER_SHARE_SELECT = {
  id: true,
  userId: true,
  password: true,
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
} as const;

export type PublicShareLookupResult =
  | {
      kind: "file";
      isLegacy: boolean;
      tokenHash: string;
      share: {
        id: string;
        userId: string;
        password: string | null;
        file: {
          id: string;
          userId: string;
          fileName: string;
          fileUrl: string;
          fileType: string | null;
          fileSize: number | null;
          isDeleted: boolean;
          isTrashed: boolean;
        } | null;
      };
    }
  | {
      kind: "folder";
      isLegacy: boolean;
      tokenHash: string;
      share: {
        id: string;
        userId: string;
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
    };

export type ShareCreationResult =
  | { success: true; password: string; expiresAt: Date | null }
  | { success: false; error: string };

function getPublicShareWhere(token: string) {
  return {
    token,
    isPublic: true,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

async function resolveFileShare(token: string) {
  const tokenHash = hashShareToken(token);
  const share = await db.share.findFirst({
    where: getPublicShareWhere(tokenHash),
    select: FILE_SHARE_SELECT,
  });

  if (share) {
    return { share, isLegacy: false, tokenHash };
  }

  const legacyShare = await db.share.findFirst({
    where: getPublicShareWhere(token),
    select: FILE_SHARE_SELECT,
  });

  if (!legacyShare) {
    return null;
  }

  return { share: legacyShare, isLegacy: true, tokenHash };
}

async function resolveFolderShare(token: string) {
  const tokenHash = hashShareToken(token);
  const share = await db.folderShare.findFirst({
    where: getPublicShareWhere(tokenHash),
    select: FOLDER_SHARE_SELECT,
  });

  if (share) {
    return { share, isLegacy: false, tokenHash };
  }

  const legacyShare = await db.folderShare.findFirst({
    where: getPublicShareWhere(token),
    select: FOLDER_SHARE_SELECT,
  });

  if (!legacyShare) {
    return null;
  }

  return { share: legacyShare, isLegacy: true, tokenHash };
}

export async function resolvePublicShareByToken(token: string): Promise<PublicShareLookupResult | null> {
  const fileShare = await resolveFileShare(token);
  if (fileShare) {
    return { kind: "file", ...fileShare };
  }

  const folderShare = await resolveFolderShare(token);
  if (folderShare) {
    return { kind: "folder", ...folderShare };
  }

  return null;
}

export async function resolvePublicShareCredentialsByToken(token: string, kind: "file" | "folder") {
  const tokenHash = hashShareToken(token);
  const share = kind === "file"
    ? await db.share.findFirst({ where: getPublicShareWhere(tokenHash), select: { id: true, password: true } })
    : await db.folderShare.findFirst({ where: getPublicShareWhere(tokenHash), select: { id: true, password: true } });

  if (share) {
    return { share, isLegacy: false, tokenHash };
  }

  const legacyShare = kind === "file"
    ? await db.share.findFirst({ where: getPublicShareWhere(token), select: { id: true, password: true } })
    : await db.folderShare.findFirst({ where: getPublicShareWhere(token), select: { id: true, password: true } });

  if (!legacyShare) {
    return null;
  }

  return { share: legacyShare, isLegacy: true, tokenHash };
}

export async function migratePublicShareToken(
  kind: "file" | "folder",
  shareId: string,
  tokenHash: string,
) {
  if (kind === "file") {
    await db.share.update({ where: { id: shareId }, data: { token: tokenHash } });
    return;
  }

  await db.folderShare.update({ where: { id: shareId }, data: { token: tokenHash } });
}

export function parseShareCreationOptions(options?: {
  password?: string;
  expiresInMinutes?: number | null;
}): ShareCreationResult {
  const normalizedPassword = options?.password?.trim();
  if (!normalizedPassword || normalizedPassword.length < SHARE_PASSWORD_MIN_LENGTH) {
    return { success: false, error: `Password must be at least ${SHARE_PASSWORD_MIN_LENGTH} characters` };
  }

  const expiresInMinutes = options?.expiresInMinutes ?? null;
  if (typeof expiresInMinutes === "number") {
    if (!Number.isFinite(expiresInMinutes) || expiresInMinutes <= 0) {
      return { success: false, error: "Expiry must be greater than zero" };
    }
    if (expiresInMinutes > SHARE_MAX_EXPIRY_MINUTES) {
      return { success: false, error: "Expiry cannot exceed 7 days" };
    }
  }

  const expiresAt = expiresInMinutes && expiresInMinutes > 0
    ? new Date(Date.now() + expiresInMinutes * 60 * 1000)
    : null;

  return { success: true, password: normalizedPassword, expiresAt };
}

export function createShareCredentials() {
  const rawToken = createRandomToken();
  return {
    rawToken,
    tokenHash: hashShareToken(rawToken),
    shareLink: buildShareLink(rawToken),
  };
}
