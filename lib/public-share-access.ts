import crypto from "crypto";

const ACCESS_COOKIE_TTL_SECONDS = 60 * 60 * 24;

function getAccessCookieSecret() {
  return process.env.SHARE_ACCESS_COOKIE_SECRET || process.env.JWT_SECRET || "dev-only-secret-change-me";
}

export function getPublicShareAccessCookieName(shareId: string) {
  return `share_access_${shareId}`;
}

export function createPublicShareAccessCookieValue(shareId: string) {
  const expiresAt = Date.now() + ACCESS_COOKIE_TTL_SECONDS * 1000;
  const payload = `${shareId}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", getAccessCookieSecret()).update(payload).digest("hex");

  return `v1.${expiresAt}.${signature}`;
}

export function isValidPublicShareAccessCookie(shareId: string, cookieValue?: string | null) {
  if (!cookieValue) return false;

  const [version, expiresAtValue, signature] = cookieValue.split(".");
  if (version !== "v1" || !expiresAtValue || !signature) return false;

  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const expectedSignature = crypto
    .createHmac("sha256", getAccessCookieSecret())
    .update(`${shareId}.${expiresAtValue}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const providedBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}