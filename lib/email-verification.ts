import crypto from "crypto";
import { TokenType } from "@prisma/client";
import { db } from "@/lib/prisma";

export const VERIFY_EMAIL_TTL_MINUTES = 5;
export const VERIFY_EMAIL_RESEND_COOLDOWN_MINUTES = 2;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(now + VERIFY_EMAIL_TTL_MINUTES * 60 * 1000);

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
  const tokenHash = hashToken(rawToken);

  const tokenRecord = await db.token.findFirst({
    where: { token: tokenHash, type: TokenType.VERIFY_EMAIL },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!tokenRecord) {
    return { status: "not_found" as const };
  }

  if (tokenRecord.expiresAt <= new Date()) {
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
