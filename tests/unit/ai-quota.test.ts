import { describe, expect, it } from 'vitest';
import { MemoryLimiter, evaluateBudget, monthStart, rateLimitKey } from '@/lib/ai/quota';

describe('evaluateBudget', () => {
  it('未达上限放行，达到或超过上限熔断', () => {
    expect(evaluateBudget(0, 3000)).toBe(true);
    expect(evaluateBudget(2999, 3000)).toBe(true);
    expect(evaluateBudget(3000, 3000)).toBe(false);
    expect(evaluateBudget(4000, 3000)).toBe(false);
  });
});

describe('MemoryLimiter', () => {
  it('一分钟内放行前 N 次，第 N+1 次给出 retryAfter', () => {
    const limiter = new MemoryLimiter();
    const now = 1_800_000_000_000;
    expect(limiter.check('u1', 3, now)).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.check('u1', 3, now)).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.check('u1', 3, now)).toEqual({ allowed: true, remaining: 0 });
    const blocked = limiter.check('u1', 3, now);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('跨窗口自动重置，不同 key 互不影响', () => {
    const limiter = new MemoryLimiter();
    const now = 1_800_000_000_000;
    limiter.check('u1', 1, now);
    expect(limiter.check('u1', 1, now).allowed).toBe(false);
    expect(limiter.check('u1', 1, now + 60_001).allowed).toBe(true);
    expect(limiter.check('u2', 1, now).allowed).toBe(true);
  });

  it('reset 清空计数', () => {
    const limiter = new MemoryLimiter();
    limiter.check('u1', 1);
    limiter.reset();
    expect(limiter.check('u1', 1).allowed).toBe(true);
  });
});

describe('窗口与月份边界', () => {
  it('同一分钟 key 相同，跨分钟不同', () => {
    const now = Date.UTC(2026, 10, 21, 12, 0, 30_000);
    expect(rateLimitKey('u1', now)).toBe(rateLimitKey('u1', now + 20_000));
    expect(rateLimitKey('u1', now)).not.toBe(rateLimitKey('u1', now + 60_000));
  });

  it('monthStart 归到 UTC 月初零点', () => {
    expect(monthStart(new Date('2026-11-21T08:30:00Z')).toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
  });
});
