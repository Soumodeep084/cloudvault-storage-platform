type Entry = { windowStart: number; count: number };

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

const store = new Map<string, Entry>();

function now() {
  return Date.now();
}

export function isRateLimited(key: string) {
  const e = store.get(key);
  if (!e) return { limited: false, retryAfterSeconds: 0 };
  const age = now() - e.windowStart;
  if (age > WINDOW_MS) return { limited: false, retryAfterSeconds: 0 };
  const limited = e.count >= MAX_ATTEMPTS;
  const retryAfterSeconds = limited ? Math.ceil((WINDOW_MS - age) / 1000) : 0;
  return { limited, retryAfterSeconds };
}

export function bumpRateLimit(key: string) {
  const e = store.get(key);
  const current = now();
  if (!e || current - e.windowStart > WINDOW_MS) {
    store.set(key, { windowStart: current, count: 1 });
    return { limited: false, retryAfterSeconds: 0 };
  }
  e.count += 1;
  store.set(key, e);
  const limited = e.count >= MAX_ATTEMPTS;
  const retryAfterSeconds = limited ? Math.ceil((WINDOW_MS - (current - e.windowStart)) / 1000) : 0;
  return { limited, retryAfterSeconds };
}

export function resetRateLimit(key: string) {
  store.delete(key);
}
