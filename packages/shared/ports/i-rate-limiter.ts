/**
 * Rate-limiter port — counts failed attempts per opaque key and locks out
 * callers once a threshold is exceeded. Kept deliberately small so it can be
 * backed by Cloudflare KV, Redis, a Durable Object, or an in-memory `Map`.
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining: number;
}

export interface IRateLimiter {
  /** Register a failed attempt and return the resulting state. */
  hit(key: string): Promise<RateLimitResult>;
  /** Clear all failed attempts for this key (call on success). */
  reset(key: string): Promise<void>;
  /** Pure read — does not mutate counters. */
  peek(key: string): Promise<RateLimitResult>;
}
