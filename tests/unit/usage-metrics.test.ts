import { describe, expect, it } from 'vitest';
import {
  budgetStatus,
  buildDailySeries,
  dayKey,
  formatCents,
  percentile,
  startOfUtcDay,
  summarizeUsage,
  type UsageJob,
} from '@/lib/usage/metrics';

const NOW = new Date('2026-11-21T12:00:00Z');

function job(overrides: Partial<UsageJob> = {}): UsageJob {
  return {
    kind: 'SUMMARIZE',
    status: 'SUCCESS',
    model: 'mock:deepseek-chat',
    promptTokens: 10,
    completionTokens: 5,
    costCents: 2,
    latencyMs: 100,
    createdAt: '2026-11-21T09:00:00Z',
    ...overrides,
  };
}

describe('percentile', () => {
  it('空数组返回 0，中位数按 nearest-rank 取', () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([5, 1, 3], 50)).toBe(3);
    expect(percentile([5, 1, 3], 100)).toBe(5);
  });

  it('P95 取第 ceil(0.95*n) 个样本', () => {
    const values = Array.from({ length: 20 }, (_, index) => index + 1);
    expect(percentile(values, 95)).toBe(19);
    expect(percentile(values, 0)).toBe(1);
  });
});

describe('UTC 日期工具', () => {
  it('dayKey 按 UTC 自然日切分，不受本地时区影响', () => {
    expect(dayKey(new Date('2026-11-21T23:59:59Z'))).toBe('2026-11-21');
    expect(dayKey('2026-11-22T00:00:00Z')).toBe('2026-11-22');
  });

  it('startOfUtcDay 归零到当天零点', () => {
    expect(startOfUtcDay(NOW).toISOString()).toBe('2026-11-21T00:00:00.000Z');
  });

  it('金额按分显示为 ¥', () => {
    expect(formatCents(1234)).toBe('¥12.34');
    expect(formatCents(0)).toBe('¥0.00');
  });
});

describe('buildDailySeries', () => {
  it('连续补零且忽略窗口外的调用', () => {
    const jobs = [
      job({ createdAt: '2026-11-21T09:00:00Z', latencyMs: 200 }),
      job({ createdAt: '2026-11-19T09:00:00Z', latencyMs: 50 }),
      job({ createdAt: '2026-11-01T09:00:00Z', latencyMs: 999 }),
    ];
    const series = buildDailySeries(jobs, 3, NOW);
    expect(series.map((point) => point.date)).toEqual(['2026-11-19', '2026-11-20', '2026-11-21']);
    expect(series.map((point) => point.calls)).toEqual([1, 0, 1]);
    expect(series[1]?.costCents).toBe(0);
    expect(series[0]?.p95LatencyMs).toBe(50);
    expect(series[2]?.p95LatencyMs).toBe(200);
  });

  it('days 被夹在 1–90 之间', () => {
    expect(buildDailySeries([], 0, NOW)).toHaveLength(1);
    expect(buildDailySeries([], 500, NOW)).toHaveLength(90);
  });
});

describe('summarizeUsage', () => {
  it('失败率只以已结束调用为分母，PENDING 单独统计', () => {
    const jobs = [
      job(),
      job(),
      job(),
      job({ status: 'FAILED' }),
      job({ status: 'PENDING', latencyMs: 0 }),
    ];
    const totals = summarizeUsage(jobs, 7, NOW);
    expect(totals.totalCalls).toBe(5);
    expect(totals.successCalls).toBe(3);
    expect(totals.failedCalls).toBe(1);
    expect(totals.pendingCalls).toBe(1);
    expect(totals.failureRate).toBe(0.25);
    expect(totals.totalTokens).toBe(75);
    expect(totals.costCents).toBe(10);
    expect(totals.series).toHaveLength(7);
  });

  it('按能力/模型分组按调用量降序，延迟排除 PENDING', () => {
    const totals = summarizeUsage(
      [
        job({ kind: 'POLISH' }),
        job({ kind: 'POLISH' }),
        job({ kind: 'TAGS', model: 'mock:other', latencyMs: 900 }),
        job({ kind: 'TAGS', status: 'PENDING', latencyMs: 0 }),
      ],
      7,
      NOW,
    );
    expect(totals.byKind.map((row) => row.key)).toEqual(['POLISH', 'TAGS']);
    expect(totals.byKind[0]?.calls).toBe(2);
    expect(totals.byModel).toHaveLength(2);
    expect(totals.p95LatencyMs).toBe(900);
  });

  it('空数据不会除零', () => {
    const totals = summarizeUsage([], 30, NOW);
    expect(totals.failureRate).toBe(0);
    expect(totals.p95LatencyMs).toBe(0);
    expect(totals.series.every((point) => point.calls === 0)).toBe(true);
  });
});

describe('budgetStatus', () => {
  it('按百分比计算并在达到上限时熔断', () => {
    expect(budgetStatus(100, 3000)).toMatchObject({
      usedPercent: 3,
      remainingCents: 2900,
      exceeded: false,
    });
    expect(budgetStatus(3000, 3000)).toMatchObject({
      usedPercent: 100,
      remainingCents: 0,
      exceeded: true,
    });
    expect(budgetStatus(4000, 3000)).toMatchObject({ usedPercent: 133, exceeded: true });
  });

  it('上限为 0 时不产生 NaN', () => {
    expect(budgetStatus(0, 0)).toMatchObject({ usedPercent: 0, remainingCents: 0, exceeded: true });
  });
});
