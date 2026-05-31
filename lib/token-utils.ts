import crypto from "crypto";

const DEFAULT_TOKEN_BYTE_LENGTH = 32;

function getShareTokenSecret() {
  // Use the share cookie secret as HMAC key. In production this must be set.
  const secret = process.env.SHARE_ACCESS_COOKIE_SECRET || process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("Missing required env: SHARE_ACCESS_COOKIE_SECRET OR JWT_SECRET");
  }
  return secret || "";
}

function hashSha256(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function hashHmacSha256(raw: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

export function createRandomToken(byteLength = DEFAULT_TOKEN_BYTE_LENGTH) {
  return crypto.randomBytes(byteLength).toString("hex");
}

export function createExpiryDate(minutes: number, now = Date.now()) {
  return new Date(now + minutes * 60 * 1000);
}

export function isExpiredDate(expiresAt: Date | string | null | undefined, now = new Date()) {
  if (!expiresAt) return false;

  const parsed = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (!Number.isFinite(parsed.getTime())) return true;

  return parsed <= now;
}

export function hashOpaqueToken(raw: string) {
  return hashSha256(raw);
}

export function hashShareToken(raw: string) {
  const secret = getShareTokenSecret();
  if (!secret) {
    // fallback to simple sha256 when running in dev without secret
    return hashSha256(raw);
  }

  return hashHmacSha256(raw, secret);
}

export function createTokenHashPair(rawToken: string) {
  return {
    rawToken,
    tokenHash: hashShareToken(rawToken),
  };
}
