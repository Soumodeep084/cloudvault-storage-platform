import { TokenType } from "@prisma/client";
import { db } from "@/lib/prisma";
import { createExpiryDate, createRandomToken, hashOpaqueToken, isExpiredDate } from "@/lib/token-utils";

export const VERIFY_EMAIL_TTL_MINUTES = 5;
export const VERIFY_EMAIL_RESEND_COOLDOWN_MINUTES = 2;

export async function issueEmailVerificationToken(
  userId: string,
  options?: { bypassCooldown?: boolean },
) {
  const bypassCooldown = options?.bypassCooldown ?? false;
  const now = Date.now();
  const cooldownMs = VERIFY_EMAIL_RESEND_COOLDOWN_MINUTES * 60 * 1000;

  const latestToken = await db.token.findFirst({
    where: { userId, type: TokenType.VERIFY_EMAIL },
    orderBy: { createdAt: "desc" },
  });

  if (!bypassCooldown && latestToken) {
    const nextAllowedAt = latestToken.createdAt.getTime() + cooldownMs;
    if (nextAllowedAt > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((nextAllowedAt - now) / 1000),
      };
    }
  }

  await db.token.deleteMany({
    where: { userId, type: TokenType.VERIFY_EMAIL },
  });

  const rawToken = createRandomToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = createExpiryDate(VERIFY_EMAIL_TTL_MINUTES, now);

  await db.token.create({
    data: {
      userId,
      token: tokenHash,
      type: TokenType.VERIFY_EMAIL,
      expiresAt,
    },
  });

  return { allowed: true, token: rawToken, expiresAt };
}

export async function consumeEmailVerificationToken(rawToken: string) {
  const tokenHash = hashOpaqueToken(rawToken);

  const tokenRecord = await db.token.findFirst({
    where: { token: tokenHash, type: TokenType.VERIFY_EMAIL },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!tokenRecord) {
    return { status: "not_found" as const };
  }

  if (isExpiredDate(tokenRecord.expiresAt)) {
    await db.token.delete({ where: { id: tokenRecord.id } });
    return { status: "expired" as const };
  }

  await db.$transaction([
    db.user.update({
      where: { id: tokenRecord.userId },
      data: { isVerified: true },
    }),
    db.token.deleteMany({
      where: { userId: tokenRecord.userId, type: TokenType.VERIFY_EMAIL },
    }),
  ]);

  return { status: "verified" as const, userId: tokenRecord.userId };
}
