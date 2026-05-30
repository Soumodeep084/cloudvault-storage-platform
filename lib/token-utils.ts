import crypto from "crypto";

function getTokenHashSecret() {
  // Use the share cookie secret as HMAC key. In production this must be set.
  const secret = process.env.SHARE_ACCESS_COOKIE_SECRET || process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("Missing required env: SHARE_ACCESS_COOKIE_SECRET OR JWT_SECRET");
  }
  return secret || "";
}

export function hashShareToken(raw: string) {
  const secret = getTokenHashSecret();
  if (!secret) {
    // fallback to simple sha256 when running in dev without secret
    return crypto.createHash("sha256").update(raw).digest("hex");
  }
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}
