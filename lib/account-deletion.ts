import crypto from "crypto";
import { TokenType } from "@prisma/client";
import { db } from "@/lib/prisma";

export const ACCOUNT_DELETE_OTP_TTL_MINUTES = 10;
export const ACCOUNT_DELETE_RESEND_COOLDOWN_MINUTES = 2;
export const ACCOUNT_DELETE_SCHEDULE_DAYS = 30;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateOtp() {
  const value = crypto.randomInt(0, 1_000_000);
  return String(value).padStart(6, "0");
}

export async function issueAccountDeletionOtp(userId: string) {
  const now = Date.now();
  const cooldownMs = ACCOUNT_DELETE_RESEND_COOLDOWN_MINUTES * 60 * 1000;

  const latestToken = await db.token.findFirst({
    where: { userId, type: TokenType.ACCOUNT_DELETE_OTP },
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
    where: { userId, type: TokenType.ACCOUNT_DELETE_OTP },
  });

  const otp = generateOtp();
  const tokenHash = hashToken(otp);
  const expiresAt = new Date(now + ACCOUNT_DELETE_OTP_TTL_MINUTES * 60 * 1000);

  await db.token.create({
    data: {
      userId,
      token: tokenHash,
      type: TokenType.ACCOUNT_DELETE_OTP,
      expiresAt,
    },
  });

  return { allowed: true, otp, expiresAt };
}

export async function validateAccountDeletionOtp(userId: string, otp: string) {
  const tokenHash = hashToken(otp);

  const tokenRecord = await db.token.findFirst({
    where: { userId, type: TokenType.ACCOUNT_DELETE_OTP, token: tokenHash },
    select: { id: true, expiresAt: true },
  });

  if (!tokenRecord) {
    return { status: "invalid" as const };
  }

  if (tokenRecord.expiresAt <= new Date()) {
    await db.token.delete({ where: { id: tokenRecord.id } });
    return { status: "expired" as const };
  }

  return { status: "valid" as const, tokenId: tokenRecord.id };
}

export async function consumeAccountDeletionOtp(userId: string, otp: string) {
  const validation = await validateAccountDeletionOtp(userId, otp);
  if (validation.status !== "valid") return validation;

  await db.token.delete({ where: { id: validation.tokenId } });
  return { status: "valid" as const };
}

export function getDeletionScheduleDate() {
  return new Date(Date.now() + 5 * 60 * 1000);
  // return new Date(Date.now() + ACCOUNT_DELETE_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);
}
