import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { monthStart } from '@/lib/ai/quota';
import { budgetStatus, startOfUtcDay, summarizeUsage } from '@/lib/usage/metrics';
import type { UsageJob } from '@/lib/usage/metrics';
import type { UsageSummaryDTO } from '@/types';

/**
 * 用量看板的数据编排：只查当前用户的 AiJob，聚合逻辑全部放在纯函数层。
 * 月度预算用「本月已花费」而不是查询区间的花费，与 rate-limit 的熔断口径一致。
 */
export async function getUsageSummary(
  userId: string,
  days = 30,
  now = new Date(),
): Promise<UsageSummaryDTO> {
  const safeDays = Math.max(1, Math.min(90, Math.trunc(days)));
  const since = new Date(startOfUtcDay(now).getTime() - (safeDays - 1) * 86_400_000);

  const [rows, monthly, failures] = await Promise.all([
    db.aiJob.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: {
        kind: true,
        status: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        costCents: true,
        latencyMs: true,
        createdAt: true,
      },
    }),
    db.aiJob.aggregate({
      where: { userId, createdAt: { gte: monthStart(now) } },
      _sum: { costCents: true },
    }),
    db.aiJob.findMany({
      where: { userId, status: 'FAILED', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, kind: true, error: true, latencyMs: true, createdAt: true },
    }),
  ]);

  const jobs: UsageJob[] = rows.map((row) => ({
    kind: row.kind,
    status: row.status,
    model: row.model,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    costCents: row.costCents,
    latencyMs: row.latencyMs,
    createdAt: row.createdAt,
  }));

  return {
    generatedAt: now.toISOString(),
    days: safeDays,
    provider: env.AI_PROVIDER,
    model: env.AI_MODEL,
    totals: summarizeUsage(jobs, safeDays, now),
    budget: budgetStatus(monthly._sum.costCents ?? 0, env.AI_MONTHLY_BUDGET_CENTS),
    recentFailures: failures.map((row) => ({
      id: row.id,
      kind: row.kind,
      error: row.error,
      latencyMs: row.latencyMs,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
