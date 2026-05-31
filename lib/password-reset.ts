import { TokenType } from "@prisma/client";
import { db } from "@/lib/prisma";
import { createExpiryDate, createRandomToken, hashOpaqueToken, isExpiredDate } from "@/lib/token-utils";

export const RESET_PASSWORD_TTL_MINUTES = 15;
export const RESET_PASSWORD_RESEND_COOLDOWN_MINUTES = 2;

export async function issuePasswordResetToken(userId: string) {
  const now = Date.now();
  const cooldownMs = RESET_PASSWORD_RESEND_COOLDOWN_MINUTES * 60 * 1000;

  const latestToken = await db.token.findFirst({
    where: { userId, type: TokenType.RESET_PASSWORD },
    orderBy: { createdAt: "desc" },
  });

  if (latestToken) {
    const nextAllowedAt = latestToken.createdAt.getTime() + cooldownMs;
    if (nextAllowedAt > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((nextAllowedAt - now) / 1000),
      };
    }
  }

  await db.token.deleteMany({
    where: { userId, type: TokenType.RESET_PASSWORD },
  });

  const rawToken = createRandomToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = createExpiryDate(RESET_PASSWORD_TTL_MINUTES, now);

  await db.token.create({
    data: {
      userId,
      token: tokenHash,
      type: TokenType.RESET_PASSWORD,
      expiresAt,
    },
  });

  return { allowed: true, token: rawToken, expiresAt };
}

export async function validatePasswordResetToken(rawToken: string) {
  const tokenHash = hashOpaqueToken(rawToken);

  const tokenRecord = await db.token.findFirst({
    where: { token: tokenHash, type: TokenType.RESET_PASSWORD },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!tokenRecord) {
    return { status: "not_found" as const };
  }

  if (isExpiredDate(tokenRecord.expiresAt)) {
    await db.token.delete({ where: { id: tokenRecord.id } });
    return { status: "expired" as const };
  }

  return { status: "valid" as const, userId: tokenRecord.userId };
}
