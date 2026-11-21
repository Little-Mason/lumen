import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TYPE_LABEL } from '@/components/status-badge';
import { calendarQuerySchema } from '@/lib/calendar/validation';
import { readSession } from '@/lib/auth/session';
import { getCalendar } from '@/server/services/calendar.service';
import type { CalendarDTO } from '@/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: '发布日历' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function Metric({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white px-4 py-3">
      <p className="text-xs text-black/50">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await readSession();
  if (!session) redirect('/login?next=/dashboard/calendar');

  const sp = await searchParams;
  const parsed = calendarQuerySchema.safeParse({
    month: typeof sp.month === 'string' ? sp.month : undefined,
  });
  const monthValue = parsed.success ? parsed.data.month : undefined;

  let calendar: CalendarDTO;
  try {
    calendar = await getCalendar(session.sub, monthValue);
  } catch {
    return (
      <div className="rounded-xl border border-amber-600/30 bg-amber-50 p-5 text-sm text-amber-900">
        数据库暂时不可用，无法加载发布日历。请确认 PostgreSQL 正在运行后刷新。
      </div>
    );
  }

  const { stats } = calendar;

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-black/50 hover:text-black/80">
        ← 返回工作台
      </Link>
      <div className="mb-5 mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">发布日历</h1>
          <p className="mt-1 text-sm text-black/55" data-testid="calendar-month">
            {calendar.label} · 真实 publishedAt 与草稿更新节奏
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/calendar?month=${calendar.prevMonth}`}
            className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm hover:border-black/40"
          >
            ← 上月
          </Link>
          <Link
            href="/dashboard/calendar"
            className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm hover:border-black/40"
          >
            本月
          </Link>
          <Link
            href={`/dashboard/calendar?month=${calendar.nextMonth}`}
            className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm hover:border-black/40"
          >
            下月 →
          </Link>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric
          label="本月发布"
          value={String(stats.publishedCount)}
          testId="calendar-published-count"
        />
        <Metric label="其中章节" value={String(stats.chapterCount)} />
        <Metric label="编辑中" value={String(stats.draftCount)} />
        <Metric label="发布天数" value={String(stats.publishDays)} />
        <Metric label="最长连更" value={`${stats.longestStreak} 天`} />
        <Metric label="累计字数" value={stats.totalWords.toLocaleString('zh-CN')} />
      </div>

      {stats.daysSinceLastPublish !== null && stats.daysSinceLastPublish > 7 && (
        <p className="mb-4 rounded-lg border border-amber-600/25 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          距上次发布已 {stats.daysSinceLastPublish} 天，注意别断更。
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
        <div className="grid grid-cols-7 border-b border-black/10 bg-black/[0.02]">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs text-black/50">
              周{day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7" data-testid="calendar-grid">
          {calendar.cells.map((cell) => (
            <div
              key={cell.date}
              className={`min-h-24 border-b border-r border-black/[0.06] p-2 last:border-r-0 ${
                cell.inMonth ? 'bg-white' : 'bg-black/[0.015]'
              } ${cell.isToday ? 'ring-1 ring-inset ring-accent' : ''}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`text-xs ${cell.inMonth ? 'text-black/60' : 'text-black/25'}`}>
                  {cell.day}
                </span>
                {cell.items.length > 0 && (
                  <span className="text-[10px] text-black/35">{cell.items.length}</span>
                )}
              </div>
              <div className="space-y-1">
                {cell.items.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={item.title}
                    className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${
                      item.status === 'PUBLISHED'
                        ? 'bg-ink/10 text-ink hover:bg-ink/20'
                        : 'border border-dashed border-black/20 text-black/55 hover:border-black/40'
                    }`}
                  >
                    {item.title}
                  </Link>
                ))}
                {cell.items.length > 3 && (
                  <span className="block px-1.5 text-[10px] text-black/40">
                    +{cell.items.length - 3} 篇
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-black/50">
        <span>实心 = 已发布</span>
        <span>虚线 = 草稿 / 评审中（按更新日期）</span>
        <span>高亮边框 = 今天</span>
        <span>
          接口 <code className="font-mono">GET /api/calendar?month={calendar.month}</code>
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold">本月条目</h2>
        {calendar.items.length === 0 ? (
          <p className="text-sm text-black/45" data-testid="calendar-empty">
            这个月还没有发布或编辑记录。
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {calendar.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="w-24 shrink-0 text-xs text-black/45">{item.date}</span>
                <Link href={item.href} className="min-w-[180px] flex-1 font-medium hover:underline">
                  {item.title}
                </Link>
                <span className="text-xs text-black/45">{TYPE_LABEL[item.type]}</span>
                <span
                  className={`text-xs ${
                    item.status === 'PUBLISHED' ? 'text-accent' : 'text-black/45'
                  }`}
                >
                  {item.status === 'PUBLISHED' ? '已发布' : '编辑中'}
                </span>
                <span className="text-xs text-black/40">{item.wordCount} 字</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-black/45">
        日历是只读的真实节奏视图：定时发布与拖拽排期尚未实现，不展示虚构的排期数据。发布后
        <code className="font-mono"> publishedAt </code> 自动写入，下线回草稿不会抹掉历史发布时间。
      </p>
    </div>
  );
}
