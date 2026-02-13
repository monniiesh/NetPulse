interface RateLimitEntry {
  timestamps: number[];
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

function getRateLimitStore(): Map<string, RateLimitEntry> {
  const g = globalThis as any;
  if (!g.__netpulseRateLimit) {
    g.__netpulseRateLimit = new Map<string, RateLimitEntry>();
  }
  return g.__netpulseRateLimit;
}

export function checkRateLimit(apiKeyPrefix: string): { allowed: boolean; retryAfter?: number } {
  const store = getRateLimitStore();
  const now = Date.now();
  const entry = store.get(apiKeyPrefix) || { timestamps: [] };

  // Remove timestamps outside window
  entry.timestamps = entry.timestamps.filter(t => now - t < WINDOW_MS);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldest = entry.timestamps[0];
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.timestamps.push(now);
  store.set(apiKeyPrefix, entry);
  return { allowed: true };
}
