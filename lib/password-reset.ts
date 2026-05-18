import crypto from "crypto";
import { TokenType } from "@prisma/client";
import { db } from "@/lib/prisma";

export const RESET_PASSWORD_TTL_MINUTES = 15;
export const RESET_PASSWORD_RESEND_COOLDOWN_MINUTES = 2;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(now + RESET_PASSWORD_TTL_MINUTES * 60 * 1000);

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
  const tokenHash = hashToken(rawToken);

  const tokenRecord = await db.token.findFirst({
    where: { token: tokenHash, type: TokenType.RESET_PASSWORD },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!tokenRecord) {
    return { status: "not_found" as const };
  }

  if (tokenRecord.expiresAt <= new Date()) {
    await db.token.delete({ where: { id: tokenRecord.id } });
    return { status: "expired" as const };
  }

  return { status: "valid" as const, userId: tokenRecord.userId };
}
