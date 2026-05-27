import crypto from "crypto";

const ACCESS_COOKIE_TTL_SECONDS = 60 * 60 * 24;
const ATTEMPT_WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;

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

function buildAttemptSignature(shareId: string, windowStart: number, count: number) {
  return crypto
    .createHmac("sha256", getAccessCookieSecret())
    .update(`${shareId}.${windowStart}.${count}`)
    .digest("hex");
}

function parseAttemptCookie(shareId: string, cookieValue?: string | null) {
  if (!cookieValue) return null;

  const [version, windowStartValue, countValue, signature] = cookieValue.split(".");
  if (version !== "v1" || !windowStartValue || !countValue || !signature) return null;

  const windowStart = Number(windowStartValue);
  const count = Number(countValue);
  if (!Number.isFinite(windowStart) || !Number.isFinite(count) || windowStart <= 0 || count <= 0) {
    return null;
  }

  const expectedSignature = buildAttemptSignature(shareId, windowStart, count);
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const providedBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== providedBuffer.length) return null;

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ? { windowStart, count }
    : null;
}

export function getPublicShareAttemptCookieName(shareId: string) {
  return `share_attempts_${shareId}`;
}

export function isPublicShareAttemptRateLimited(shareId: string, cookieValue?: string | null) {
  const state = parseAttemptCookie(shareId, cookieValue);
  if (!state) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  const ageMs = Date.now() - state.windowStart;
  if (ageMs > ATTEMPT_WINDOW_SECONDS * 1000) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  const limited = state.count >= MAX_ATTEMPTS;
  const retryAfterSeconds = limited
    ? Math.ceil((ATTEMPT_WINDOW_SECONDS * 1000 - ageMs) / 1000)
    : 0;

  return { limited, retryAfterSeconds };
}

export function bumpPublicShareAttempt(shareId: string, cookieValue?: string | null) {
  const now = Date.now();
  const state = parseAttemptCookie(shareId, cookieValue);

  let windowStart = now;
  let count = 1;

  if (state && now - state.windowStart <= ATTEMPT_WINDOW_SECONDS * 1000) {
    windowStart = state.windowStart;
    count = state.count + 1;
  }

  const signature = buildAttemptSignature(shareId, windowStart, count);
  const value = `v1.${windowStart}.${count}.${signature}`;
  const limited = count >= MAX_ATTEMPTS;
  const retryAfterSeconds = limited
    ? Math.ceil((ATTEMPT_WINDOW_SECONDS * 1000 - (now - windowStart)) / 1000)
    : 0;

  return { value, limited, retryAfterSeconds };
}