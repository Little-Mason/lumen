import { describe, expect, it } from 'vitest';
import {
  buildMonthCells,
  daysBetween,
  distinctDays,
  longestStreak,
  parseMonth,
  shiftMonth,
} from '@/lib/calendar/grid';
import type { CalendarItemDTO } from '@/types';

const NOW = new Date('2026-11-21T10:00:00Z');

function item(date: string, id = date): CalendarItemDTO {
  return {
    id,
    title: `内容 ${id}`,
    slug: id,
    type: 'ARTICLE',
    status: 'PUBLISHED',
    date,
    publishedAt: `${date}T09:00:00.000Z`,
    wordCount: 120,
    href: `/posts/${id}`,
  };
}

describe('parseMonth', () => {
  it('解析合法 YYYY-MM 并给出左闭右开区间', () => {
    const month = parseMonth('2026-02', NOW);
    expect(month).toMatchObject({ year: 2026, month: 2, key: '2026-02', label: '2026 年 2 月' });
    expect(month.start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(month.end.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('非法输入回退到当前 UTC 月份', () => {
    expect(parseMonth('2026-13', NOW).key).toBe('2026-11');
    expect(parseMonth('not-a-month', NOW).key).toBe('2026-11');
    expect(parseMonth(undefined, NOW).key).toBe('2026-11');
  });
});

describe('shiftMonth', () => {
  it('跨年翻页不出现 0 月或 13 月', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-11', -1)).toBe('2026-10');
  });
});

describe('buildMonthCells', () => {
  it('周一开头，11 月需要 6 行并保留 42 格', () => {
    const cells = buildMonthCells(parseMonth('2026-11', NOW), [], NOW);
    expect(cells).toHaveLength(42);
    expect(cells[0]?.date).toBe('2026-10-26');
    expect(cells[0]?.inMonth).toBe(false);
    expect(cells.find((cell) => cell.date === '2026-11-01')?.inMonth).toBe(true);
    expect(cells.find((cell) => cell.date === '2026-11-21')?.isToday).toBe(true);
    expect(cells[cells.length - 1]?.date).toBe('2026-12-06');
  });

  it('末周整周不在当月时裁成 5 行', () => {
    const cells = buildMonthCells(parseMonth('2026-02', NOW), [], NOW);
    expect(cells).toHaveLength(35);
    expect(cells[34]?.date).toBe('2026-03-01');
    expect(cells[34]?.inMonth).toBe(false);
  });

  it('同一天的多个条目聚合到同一个格子', () => {
    const items = [item('2026-11-21', 'a'), item('2026-11-21', 'b'), item('2026-11-05', 'c')];
    const cells = buildMonthCells(parseMonth('2026-11', NOW), items, NOW);
    expect(cells.find((cell) => cell.date === '2026-11-21')?.items).toHaveLength(2);
    expect(cells.find((cell) => cell.date === '2026-11-05')?.items[0]?.title).toBe('内容 c');
    expect(cells.find((cell) => cell.date === '2026-11-20')?.items).toHaveLength(0);
  });
});

describe('连更统计', () => {
  it('去重、排序后计算最长连续天数，断更会打断', () => {
    expect(longestStreak(['2026-11-01', '2026-11-02', '2026-11-02', '2026-11-04'])).toBe(2);
    expect(longestStreak(['2026-11-01', '2026-11-02', '2026-11-03'])).toBe(3);
    expect(longestStreak([])).toBe(0);
    expect(distinctDays(['2026-11-01', '2026-11-01', '2026-11-02'])).toBe(2);
  });

  it('daysBetween 只返回非负整天数', () => {
    expect(daysBetween(new Date('2026-11-18T10:00:00Z'), new Date('2026-11-21T09:00:00Z'))).toBe(2);
    expect(daysBetween(new Date('2026-11-22T00:00:00Z'), NOW)).toBe(0);
  });
});
