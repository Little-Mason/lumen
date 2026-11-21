/** 日历网格的纯函数：月份解析、周一开始的 6 周网格、连更统计。 */
import { dayKey } from '@/lib/usage/metrics';
import type { CalendarCellDTO, CalendarItemDTO } from '@/types';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_MS = 86_400_000;

export type ParsedMonth = {
  year: number;
  month: number;
  key: string;
  label: string;
  start: Date;
  end: Date;
};

/** 只接受 YYYY-MM；非法输入回退到当前 UTC 月份，不让 URL 参数打崩页面。 */
export function parseMonth(value?: string | null, now = new Date()): ParsedMonth {
  const match = MONTH_RE.exec((value ?? '').trim());
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) : now.getUTCMonth() + 1;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    year,
    month,
    key: `${year}-${String(month).padStart(2, '0')}`,
    label: `${year} 年 ${month} 月`,
    start,
    end,
  };
}

export function shiftMonth(key: string, delta: number): string {
  const parsed = parseMonth(key);
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 周一为一周第一天；末周若整周都不在当月则裁掉，避免多一行空白。 */
export function buildMonthCells(
  month: ParsedMonth,
  items: CalendarItemDTO[],
  today = new Date(),
): CalendarCellDTO[] {
  const first = new Date(Date.UTC(month.year, month.month - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = first.getTime() - mondayOffset * DAY_MS;
  const byDay = new Map<string, CalendarItemDTO[]>();
  for (const item of items) {
    const bucket = byDay.get(item.date) ?? [];
    bucket.push(item);
    byDay.set(item.date, bucket);
  }

  const todayKey = dayKey(today);
  const cells: CalendarCellDTO[] = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart + index * DAY_MS);
    const key = dayKey(date);
    return {
      date: key,
      day: date.getUTCDate(),
      inMonth: date.getUTCFullYear() === month.year && date.getUTCMonth() === month.month - 1,
      isToday: key === todayKey,
      items: byDay.get(key) ?? [],
    };
  });

  if (cells.slice(35).every((cell) => !cell.inMonth)) return cells.slice(0, 35);
  return cells;
}

export function distinctDays(dates: string[]): number {
  return new Set(dates.map((date) => date.slice(0, 10))).size;
}

/** 最长连续发布天数；输入可以重复、可以乱序。 */
export function longestStreak(dates: string[]): number {
  const days = [...new Set(dates.map((date) => date.slice(0, 10)))]
    .map((date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  let best = 0;
  let current = 0;
  let previous = Number.NaN;
  for (const day of days) {
    current = day === previous + 1 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = day;
  }
  return best;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}
