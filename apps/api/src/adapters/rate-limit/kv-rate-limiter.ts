import type { KVNamespace } from '@cloudflare/workers-types';
import type { IRateLimiter, RateLimitResult } from '@arenaquest/shared/ports';

export interface KvRateLimiterConfig {
  /** Sliding window over which attempts accumulate. */
  windowMs?: number;
  /** Attempts allowed within the window before lockout kicks in. */
  maxAttempts?: number;
  /** How long a lockout lasts once triggered. */
  lockoutMs?: number;
  /** Namespace prefix for keys (keeps this adapter reusable for non-login flows). */
  prefix?: string;
}

interface BucketRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const DEFAULTS = {
  windowMs: 10 * 60_000,
  maxAttempts: 5,
  lockoutMs: 15 * 60_000,
  prefix: 'rl:login:',
} as const;

export class KvRateLimiter implements IRateLimiter {
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly lockoutMs: number;
  private readonly prefix: string;

  constructor(
    private readonly kv: KVNamespace,
    config: KvRateLimiterConfig = {},
  ) {
    this.windowMs = config.windowMs ?? DEFAULTS.windowMs;
    this.maxAttempts = config.maxAttempts ?? DEFAULTS.maxAttempts;
    this.lockoutMs = config.lockoutMs ?? DEFAULTS.lockoutMs;
    this.prefix = config.prefix ?? DEFAULTS.prefix;
  }

  async peek(key: string): Promise<RateLimitResult> {
    const record = await this.read(key);
    return this.snapshot(record, Date.now());
  }

  async hit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = await this.read(key);

    // If the window has expired, start a fresh bucket.
    const fresh =
      !existing || now - existing.firstAttemptAt > this.windowMs
        ? { count: 0, firstAttemptAt: now, lockedUntil: null as number | null }
        : { ...existing };

    fresh.count += 1;

    if (fresh.count >= this.maxAttempts) {
      fresh.lockedUntil = now + this.lockoutMs;
    }

    await this.write(key, fresh);
    return this.snapshot(fresh, now);
  }

  async reset(key: string): Promise<void> {
    await this.kv.delete(this.k(key));
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private k(key: string): string {
    return this.prefix + key;
  }

  private async read(key: string): Promise<BucketRecord | null> {
    const raw = await this.kv.get(this.k(key), 'json');
    return (raw as BucketRecord | null) ?? null;
  }

  private async write(key: string, record: BucketRecord): Promise<void> {
    // TTL mirrors the lockout so KV garbage-collects stale buckets.
    const ttl = Math.ceil(this.lockoutMs / 1000);
    await this.kv.put(this.k(key), JSON.stringify(record), { expirationTtl: ttl });
  }

  private snapshot(record: BucketRecord | null, now: number): RateLimitResult {
    if (!record) {
      return { allowed: true, remaining: this.maxAttempts };
    }
    if (record.lockedUntil && record.lockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000),
        remaining: 0,
      };
    }
    // Window elapsed — treat as clean slate for accounting purposes.
    if (now - record.firstAttemptAt > this.windowMs) {
      return { allowed: true, remaining: this.maxAttempts };
    }
    return {
      allowed: true,
      remaining: Math.max(0, this.maxAttempts - record.count),
    };
  }
}
