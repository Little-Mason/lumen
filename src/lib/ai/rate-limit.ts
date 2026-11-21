import Redis from 'ioredis';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { AiError } from '@/lib/ai/errors';
import { logger } from '@/lib/logger';
import { MemoryLimiter, evaluateBudget, monthStart, rateLimitKey } from '@/lib/ai/quota';

/**
 * 每分钟每用户限流：配置 REDIS_URL 时走 Redis INCR + EXPIRE（多实例共享），
 * 否则或连接失败时降级到进程内计数器，保证本地与 CI 零依赖可跑。
 * 月度预算以 AiJob.costCents 汇总为准，跨实例一致。
 */

const fallbackLimiter = new MemoryLimiter();
let redis: Redis | null = null;
let budgetCache: { spent: number; at: number } | null = null;

function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    redis.on('error', (error: Error) => logger.warn('redis unavailable', { error: error.message }));
  }
  return redis;
}

/**
 * Redis 可能比应用晚启动。首次连接失败后 ioredis 会停在 `end`，
 * 每次请求都再试一次 connect()，恢复后自动切回 Redis，不重启进程。
 */
async function ensureConnected(client: Redis): Promise<boolean> {
  // Read through a function so TypeScript does not narrow `status` across
  // the awaited connect() call, which mutates it.
  const status = (): string => client.status;
  if (status() === 'ready') return true;
  if (status() === 'connect' || status() === 'reconnecting') return false;
  try {
    await client.connect();
    return status() === 'ready';
  } catch {
    return false;
  }
}

export async function checkRateLimit(userId: string, now = Date.now()): Promise<void> {
  const limit = env.AI_RATE_LIMIT_PER_MIN;
  const key = rateLimitKey(userId, now);
  const client = getRedis();

  if (client) {
    try {
      if (!(await ensureConnected(client))) throw new Error('redis not ready');
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, 70);
      if (count > limit) {
        throw new AiError('RATE_LIMITED', `每分钟最多 ${limit} 次 AI 调用，请稍后再试`, 60);
      }
      return;
    } catch (error) {
      if (error instanceof AiError) throw error;
      logger.warn('redis rate limit degraded to memory', { error: String(error) });
    }
  }

  const verdict = fallbackLimiter.check(key, limit, now);
  if (!verdict.allowed) {
    throw new AiError(
      'RATE_LIMITED',
      `每分钟最多 ${limit} 次 AI 调用，请稍后再试`,
      verdict.retryAfterSeconds,
    );
  }
}

export async function checkMonthlyBudget(now = Date.now()): Promise<void> {
  if (budgetCache && now - budgetCache.at < 30_000) {
    if (!evaluateBudget(budgetCache.spent, env.AI_MONTHLY_BUDGET_CENTS)) {
      throw new AiError('BUDGET_EXCEEDED', '本月 AI 预算已用尽，工作台仍可手动写作');
    }
    return;
  }

  const aggregate = await db.aiJob.aggregate({
    _sum: { costCents: true },
    where: { createdAt: { gte: monthStart(new Date(now)) } },
  });
  const spent = aggregate._sum.costCents ?? 0;
  budgetCache = { spent, at: now };

  if (!evaluateBudget(spent, env.AI_MONTHLY_BUDGET_CENTS)) {
    throw new AiError('BUDGET_EXCEEDED', '本月 AI 预算已用尽，工作台仍可手动写作');
  }
}

export async function assertAiQuota(userId: string): Promise<void> {
  await checkRateLimit(userId);
  await checkMonthlyBudget();
}

/** 供测试与后台重置缓存用。 */
export function resetQuotaState(): void {
  fallbackLimiter.reset();
  budgetCache = null;
}
