import crypto from "crypto";
import { TokenType } from "@prisma/client";
import { db } from "@/lib/prisma";

export const ACCOUNT_RESTORE_OTP_TTL_MINUTES = 10;
export const ACCOUNT_RESTORE_RESEND_COOLDOWN_SECONDS = 45;
export const ACCOUNT_RESTORE_OTP_MAX_ATTEMPTS = 5;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateOtp() {
  const value = crypto.randomInt(0, 1_000_000);
  return String(value).padStart(6, "0");
}

export async function issueAccountRestoreOtp(userId: string) {
  const now = Date.now();
  const cooldownMs = ACCOUNT_RESTORE_RESEND_COOLDOWN_SECONDS * 1000;

  const latestToken = await db.token.findFirst({
    where: { userId, type: TokenType.ACCOUNT_RESTORE_OTP },
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
    where: { userId, type: TokenType.ACCOUNT_RESTORE_OTP },
  });

  const otp = generateOtp();
  const tokenHash = hashToken(otp);
  const expiresAt = new Date(now + ACCOUNT_RESTORE_OTP_TTL_MINUTES * 60 * 1000);

  await db.token.create({
    data: {
      userId,
      token: tokenHash,
      type: TokenType.ACCOUNT_RESTORE_OTP,
      expiresAt,
    },
  });

  return { allowed: true, otp, expiresAt };
}

export async function validateAccountRestoreOtp(userId: string, otp: string) {
  const tokenRecord = await db.token.findFirst({
    where: { userId, type: TokenType.ACCOUNT_RESTORE_OTP },
    orderBy: { createdAt: "desc" },
  });

  if (!tokenRecord) {
    return { status: "invalid" as const };
  }

  if (tokenRecord.expiresAt <= new Date()) {
    await db.token.delete({ where: { id: tokenRecord.id } });
    return { status: "expired" as const };
  }

  if (tokenRecord.attempts >= ACCOUNT_RESTORE_OTP_MAX_ATTEMPTS) {
    await db.token.deleteMany({
      where: { userId, type: TokenType.ACCOUNT_RESTORE_OTP },
    });
    return { status: "locked" as const };
  }

  const tokenHash = hashToken(otp);
  if (tokenHash !== tokenRecord.token) {
    const nextAttempts = tokenRecord.attempts + 1;

    if (nextAttempts >= ACCOUNT_RESTORE_OTP_MAX_ATTEMPTS) {
      await db.token.deleteMany({
        where: { userId, type: TokenType.ACCOUNT_RESTORE_OTP },
      });
      return { status: "locked" as const };
    }

    await db.token.update({
      where: { id: tokenRecord.id },
      data: { attempts: nextAttempts },
    });

    return {
      status: "invalid" as const,
      remainingAttempts: ACCOUNT_RESTORE_OTP_MAX_ATTEMPTS - nextAttempts,
    };
  }

  return { status: "valid" as const, tokenId: tokenRecord.id };
}

export async function consumeAccountRestoreOtp(userId: string, otp: string) {
  const validation = await validateAccountRestoreOtp(userId, otp);
  if (validation.status !== "valid") return validation;

  await db.token.delete({ where: { id: validation.tokenId } });
  return { status: "valid" as const };
}
