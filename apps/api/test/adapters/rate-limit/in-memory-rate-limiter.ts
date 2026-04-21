import type { IRateLimiter, RateLimitResult } from '@arenaquest/shared/ports';

export interface InMemoryRateLimiterConfig {
  windowMs?: number;
  maxAttempts?: number;
  lockoutMs?: number;
}

interface Bucket {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

export class InMemoryRateLimiter implements IRateLimiter {
  readonly windowMs: number;
  readonly maxAttempts: number;
  readonly lockoutMs: number;
  private readonly store = new Map<string, Bucket>();

  constructor(config: InMemoryRateLimiterConfig = {}) {
    this.windowMs = config.windowMs ?? 10 * 60_000;
    this.maxAttempts = config.maxAttempts ?? 5;
    this.lockoutMs = config.lockoutMs ?? 15 * 60_000;
  }

  async peek(key: string): Promise<RateLimitResult> {
    return this.snapshot(this.store.get(key), Date.now());
  }

  async hit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const prev = this.store.get(key);
    const bucket: Bucket =
      !prev || now - prev.firstAttemptAt > this.windowMs
        ? { count: 0, firstAttemptAt: now, lockedUntil: null }
        : { ...prev };
    bucket.count += 1;
    if (bucket.count >= this.maxAttempts) {
      bucket.lockedUntil = now + this.lockoutMs;
    }
    this.store.set(key, bucket);
    return this.snapshot(bucket, now);
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  private snapshot(bucket: Bucket | undefined, now: number): RateLimitResult {
    if (!bucket) return { allowed: true, remaining: this.maxAttempts };
    if (bucket.lockedUntil && bucket.lockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1000),
        remaining: 0,
      };
    }
    if (now - bucket.firstAttemptAt > this.windowMs) {
      return { allowed: true, remaining: this.maxAttempts };
    }
    return {
      allowed: true,
      remaining: Math.max(0, this.maxAttempts - bucket.count),
    };
  }
}
