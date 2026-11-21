/** 纯函数配额逻辑，不依赖 env / db，便于单测覆盖窗口与预算边界。 */

export type RateVerdict =
  { allowed: true; remaining: number } | { allowed: false; retryAfterSeconds: number };

export function evaluateBudget(spentCents: number, limitCents: number): boolean {
  return spentCents < limitCents;
}

/** 固定一分钟窗口的内存计数器（Redis 不可用时的降级实现）。 */
export class MemoryLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  check(key: string, limit: number, now = Date.now()): RateVerdict {
    const windowMs = 60_000;
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1 };
    }
    if (current.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }
    current.count += 1;
    return { allowed: true, remaining: limit - current.count };
  }

  reset(): void {
    this.buckets.clear();
  }
}

export function rateLimitKey(userId: string, now = Date.now()): string {
  return `lumen:ai:rate:${userId}:${Math.floor(now / 60_000)}`;
}

export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
