const windows = new Map<string, number[]>();

export function checkRateLimit(
  userId: string,
  maxRequests: number,
  windowMs: number,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number } {
  const cutoff = now - windowMs;
  const previous = (windows.get(userId) ?? []).filter((stamp) => stamp > cutoff);
  if (previous.length >= maxRequests) {
    const retryAfterSec = Math.max(1, Math.ceil((previous[0] + windowMs - now) / 1000));
    windows.set(userId, previous);
    return { ok: false, retryAfterSec };
  }
  previous.push(now);
  windows.set(userId, previous);
  return { ok: true };
}

export function resetRateLimitForTests() {
  windows.clear();
}
