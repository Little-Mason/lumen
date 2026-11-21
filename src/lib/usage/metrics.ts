/**
 * 用量聚合的纯函数层：不碰 Prisma / env，输入 AiJob 的扁平投影即可单测。
 * 所有日期一律按 UTC 自然日切分，避免服务器时区让看板前后端对不上。
 */
import type { UsageBreakdown, UsageDailyPoint, UsageTotals } from '@/types';

export type UsageJob = {
  kind: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  model: string;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  latencyMs: number;
  createdAt: Date | string;
};

export function dayKey(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** 分为单位存储，界面统一显示 ¥。 */
export function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

/** nearest-rank 百分位；空数组返回 0。P95 = 第 ceil(0.95 * n) 个样本。 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((Math.min(100, Math.max(0, p)) / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))] ?? 0;
}

function emptyPoint(date: string): UsageDailyPoint {
  return {
    date,
    calls: 0,
    successes: 0,
    failures: 0,
    costCents: 0,
    tokens: 0,
    p95LatencyMs: 0,
  };
}

/** 生成连续 days 天的日序列，没有调用的日子补零，图表不会出现断档。 */
export function buildDailySeries(jobs: UsageJob[], days: number, now: Date): UsageDailyPoint[] {
  const safeDays = Math.max(1, Math.min(90, Math.trunc(days)));
  const today = startOfUtcDay(now).getTime();
  const points = new Map<string, UsageDailyPoint>();
  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const key = dayKey(new Date(today - i * 86_400_000));
    points.set(key, emptyPoint(key));
  }

  for (const job of jobs) {
    const point = points.get(dayKey(job.createdAt));
    if (!point) continue;
    point.calls += 1;
    if (job.status === 'SUCCESS') point.successes += 1;
    if (job.status === 'FAILED') point.failures += 1;
    point.costCents += job.costCents;
    point.tokens += job.promptTokens + job.completionTokens;
  }

  const result = [...points.values()];
  const latencies = new Map<string, number[]>();
  for (const job of jobs) {
    if (job.status === 'PENDING' || job.latencyMs <= 0) continue;
    const key = dayKey(job.createdAt);
    const bucket = latencies.get(key) ?? [];
    bucket.push(job.latencyMs);
    latencies.set(key, bucket);
  }
  for (const point of result) point.p95LatencyMs = percentile(latencies.get(point.date) ?? [], 95);
  return result;
}

function breakdown(jobs: UsageJob[], pick: (job: UsageJob) => string): UsageBreakdown[] {
  const groups = new Map<string, UsageJob[]>();
  for (const job of jobs) {
    const key = pick(job);
    const bucket = groups.get(key) ?? [];
    bucket.push(job);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .map(([key, rows]) => ({
      key,
      calls: rows.length,
      failures: rows.filter((r) => r.status === 'FAILED').length,
      costCents: rows.reduce((sum, r) => sum + r.costCents, 0),
      p95LatencyMs: percentile(
        rows.filter((r) => r.status !== 'PENDING' && r.latencyMs > 0).map((r) => r.latencyMs),
        95,
      ),
    }))
    .sort((a, b) => b.calls - a.calls || a.key.localeCompare(b.key));
}

export function summarizeUsage(jobs: UsageJob[], days: number, now: Date): UsageTotals {
  const finished = jobs.filter((job) => job.status !== 'PENDING');
  const failed = finished.filter((job) => job.status === 'FAILED');
  const latencies = jobs
    .filter((job) => job.status !== 'PENDING' && job.latencyMs > 0)
    .map((job) => job.latencyMs);

  return {
    totalCalls: jobs.length,
    successCalls: jobs.filter((job) => job.status === 'SUCCESS').length,
    failedCalls: failed.length,
    pendingCalls: jobs.filter((job) => job.status === 'PENDING').length,
    failureRate: finished.length === 0 ? 0 : failed.length / finished.length,
    promptTokens: jobs.reduce((sum, job) => sum + job.promptTokens, 0),
    completionTokens: jobs.reduce((sum, job) => sum + job.completionTokens, 0),
    totalTokens: jobs.reduce((sum, job) => sum + job.promptTokens + job.completionTokens, 0),
    costCents: jobs.reduce((sum, job) => sum + job.costCents, 0),
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    byKind: breakdown(jobs, (job) => job.kind),
    byModel: breakdown(jobs, (job) => job.model),
    series: buildDailySeries(jobs, days, now),
  };
}

export function budgetStatus(spentCents: number, limitCents: number) {
  const safeLimit = Math.max(0, limitCents);
  const usedPercent = safeLimit === 0 ? 0 : Math.round((spentCents / safeLimit) * 100);
  return {
    spentCents,
    limitCents: safeLimit,
    usedPercent,
    remainingCents: Math.max(0, safeLimit - spentCents),
    exceeded: spentCents >= safeLimit,
  };
}
