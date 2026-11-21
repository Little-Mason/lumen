import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth/session';
import { formatCents } from '@/lib/usage/metrics';
import { usageQuerySchema } from '@/lib/usage/validation';
import { getUsageSummary } from '@/server/services/usage.service';
import type { UsageSummaryDTO } from '@/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: '用量与成本' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const RANGES = [7, 30, 90] as const;

const KIND_LABEL: Record<string, string> = {
  OUTLINE: '生成大纲',
  TITLE: '生成标题',
  TAGS: '生成标签',
  SUMMARIZE: '生成摘要',
  POLISH: '润色',
  RAG_ASK: '知识库问答',
};

function Stat({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: string;
  hint: string;
  testId?: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <p className="text-xs text-black/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight" data-testid={testId}>
        {value}
      </p>
      <p className="mt-1 text-xs text-black/40">{hint}</p>
    </div>
  );
}

export default async function UsagePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await readSession();
  if (!session) redirect('/login?next=/dashboard/usage');

  const sp = await searchParams;
  const parsed = usageQuerySchema.safeParse({
    days: typeof sp.days === 'string' ? sp.days : undefined,
  });
  const days = parsed.success ? parsed.data.days : 30;

  let summary: UsageSummaryDTO;
  try {
    summary = await getUsageSummary(session.sub, days);
  } catch {
    return (
      <div className="rounded-xl border border-amber-600/30 bg-amber-50 p-5 text-sm text-amber-900">
        数据库暂时不可用，无法加载用量数据。请确认 PostgreSQL 正在运行后刷新。
      </div>
    );
  }

  const { totals, budget } = summary;
  const maxCalls = Math.max(1, ...totals.series.map((point) => point.calls));
  const barWidth = Math.min(100, Math.max(0, budget.usedPercent));
  const barColor =
    budget.usedPercent >= 80 ? 'bg-red-500' : budget.usedPercent >= 50 ? 'bg-amber-500' : 'bg-ink';
  const recent = totals.series.slice(-7).reverse();

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-black/50 hover:text-black/80">
        ← 返回工作台
      </Link>
      <div className="mb-1 mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">用量与成本</h1>
          <p className="mt-1 text-sm text-black/55">
            最近 {summary.days} 天 · 数据来自每次 AI 调用落库的 AiJob
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((range) => (
            <Link
              key={range}
              href={`/dashboard/usage?days=${range}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                days === range
                  ? 'border-ink bg-ink text-white'
                  : 'border-black/15 bg-white text-black/60 hover:border-black/40'
              }`}
            >
              {range} 天
            </Link>
          ))}
        </div>
      </div>

      {summary.provider === 'mock' && (
        <p className="mb-5 mt-3 rounded-lg border border-amber-600/25 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          当前为 mock
          provider：模型未真正调用，成本按真实模型单价估算，仅用于演示看板，不产生实际费用。
          生产环境请设置 <code className="font-mono">AI_PROVIDER=openai-compatible</code>。
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="调用次数"
          value={String(totals.totalCalls)}
          hint={`成功 ${totals.successCalls} · 失败 ${totals.failedCalls} · 进行中 ${totals.pendingCalls}`}
          testId="usage-total-calls"
        />
        <Stat
          label="失败率"
          value={`${(totals.failureRate * 100).toFixed(1)}%`}
          hint="已结束调用中失败占比"
          testId="usage-failure-rate"
        />
        <Stat
          label="区间成本"
          value={formatCents(totals.costCents)}
          hint={`${totals.totalTokens.toLocaleString('zh-CN')} tokens`}
          testId="usage-cost"
        />
        <Stat
          label="P50 / P95 延迟"
          value={`${totals.p50LatencyMs} / ${totals.p95LatencyMs} ms`}
          hint="只统计已结束且有耗时的调用"
          testId="usage-p95"
        />
        <Stat
          label="本月预算已用"
          value={`${budget.usedPercent}%`}
          hint={`${formatCents(budget.spentCents)} / ${formatCents(budget.limitCents)}`}
          testId="usage-budget"
        />
        <Stat label="当前模型" value={summary.model} hint={`provider: ${summary.provider}`} />
      </div>

      <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">月度预算</h2>
          <span className="text-xs text-black/45">
            剩余 {formatCents(budget.remainingCents)}
            {budget.exceeded ? ' · 已触发预算熔断' : ''}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
        </div>
        <p className="mt-2 text-xs text-black/45">
          预算按自然月（UTC）累计，超限后 <code className="font-mono">assertAiQuota</code> 拒绝新的
          AI 调用。
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">每日调用量</h2>
          <span className="text-xs text-black/45">峰值 {maxCalls} 次 / 天</span>
        </div>
        <div className="flex h-32 items-end gap-px" data-testid="usage-series">
          {totals.series.map((point) => (
            <div
              key={point.date}
              className="group relative flex h-full flex-1 items-end"
              title={`${point.date} · ${point.calls} 次 · ${formatCents(point.costCents)} · P95 ${point.p95LatencyMs}ms`}
            >
              <div
                className={`w-full rounded-t ${point.failures > 0 ? 'bg-red-400' : 'bg-ink/75'}`}
                style={{
                  height: `${Math.max(point.calls > 0 ? 4 : 1, (point.calls / maxCalls) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-black/40">
          <span>{totals.series[0]?.date}</span>
          <span>红色表示该日有失败调用</span>
          <span>{totals.series[totals.series.length - 1]?.date}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold">按能力类型</h2>
          {totals.byKind.length === 0 ? (
            <p className="text-sm text-black/45" data-testid="usage-empty">
              区间内还没有 AI 调用。
            </p>
          ) : (
            <table className="w-full text-left text-sm" data-testid="usage-kind-table">
              <thead className="text-xs text-black/45">
                <tr>
                  <th className="pb-2">能力</th>
                  <th className="pb-2 text-right">调用</th>
                  <th className="pb-2 text-right">失败</th>
                  <th className="pb-2 text-right">成本</th>
                  <th className="pb-2 text-right">P95</th>
                </tr>
              </thead>
              <tbody>
                {totals.byKind.map((row) => (
                  <tr key={row.key} className="border-t border-black/[0.06]">
                    <td className="py-2">{KIND_LABEL[row.key] ?? row.key}</td>
                    <td className="py-2 text-right">{row.calls}</td>
                    <td className="py-2 text-right">{row.failures}</td>
                    <td className="py-2 text-right">{formatCents(row.costCents)}</td>
                    <td className="py-2 text-right">{row.p95LatencyMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {totals.totalCalls === 0 && (
            <Link
              href="/dashboard/ai"
              className="mt-3 inline-block text-sm text-accent hover:underline"
            >
              去 AI 工作台跑一次生成 →
            </Link>
          )}
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold">最近 7 天</h2>
          <table className="w-full text-left text-sm" data-testid="usage-daily-table">
            <thead className="text-xs text-black/45">
              <tr>
                <th className="pb-2">日期</th>
                <th className="pb-2 text-right">调用</th>
                <th className="pb-2 text-right">失败</th>
                <th className="pb-2 text-right">成本</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((point) => (
                <tr key={point.date} className="border-t border-black/[0.06]">
                  <td className="py-2 text-black/70">{point.date}</td>
                  <td className="py-2 text-right">{point.calls}</td>
                  <td className="py-2 text-right">{point.failures}</td>
                  <td className="py-2 text-right">{formatCents(point.costCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mb-2 mt-5 text-sm font-medium">最近失败</h3>
          {summary.recentFailures.length === 0 ? (
            <p className="text-xs text-black/45" data-testid="usage-failures">
              区间内没有失败调用。
            </p>
          ) : (
            <ul className="space-y-1 text-xs text-black/60" data-testid="usage-failures">
              {summary.recentFailures.map((failure) => (
                <li key={failure.id} className="truncate">
                  {failure.createdAt.slice(0, 16).replace('T', ' ')} ·{' '}
                  {KIND_LABEL[failure.kind] ?? failure.kind} · {failure.error ?? '未知错误'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-5 text-xs text-black/40">
        统计时间 {summary.generatedAt.replace('T', ' ').slice(0, 19)} UTC · 接口{' '}
        <code className="font-mono">GET /api/ai/usage?days={days}</code>
      </p>
    </div>
  );
}
