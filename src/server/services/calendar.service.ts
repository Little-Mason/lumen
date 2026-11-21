import { db } from '@/lib/db';
import {
  buildMonthCells,
  daysBetween,
  distinctDays,
  longestStreak,
  parseMonth,
  shiftMonth,
} from '@/lib/calendar/grid';
import { dayKey } from '@/lib/usage/metrics';
import type { CalendarDTO, CalendarItemDTO } from '@/types';

/**
 * 发布日历：以 Content.publishedAt 为唯一事实来源，草稿/评审按 updatedAt 标为「编辑中」。
 * 目前不做定时发布与拖拽排期——日历是真实节奏的只读视图，不伪造排期数据。
 */
export async function getCalendar(
  authorId: string,
  monthValue?: string,
  now = new Date(),
): Promise<CalendarDTO> {
  const month = parseMonth(monthValue, now);
  const range = { gte: month.start, lt: month.end };

  const [published, drafts, lastPublished] = await Promise.all([
    db.content.findMany({
      where: { authorId, status: 'PUBLISHED', publishedAt: range },
      orderBy: { publishedAt: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        wordCount: true,
        publishedAt: true,
      },
    }),
    db.content.findMany({
      where: { authorId, status: { in: ['DRAFT', 'REVIEW'] }, updatedAt: range },
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        status: true,
        wordCount: true,
        updatedAt: true,
      },
    }),
    db.content.findFirst({
      where: { authorId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    }),
  ]);

  const publishedItems: CalendarItemDTO[] = published.flatMap((row) => {
    if (!row.publishedAt) return [];
    return [
      {
        id: row.id,
        title: row.title,
        slug: row.slug,
        type: row.type,
        status: 'PUBLISHED',
        date: dayKey(row.publishedAt),
        publishedAt: row.publishedAt.toISOString(),
        wordCount: row.wordCount,
        href: `/posts/${encodeURIComponent(row.slug)}`,
      },
    ];
  });

  const draftItems: CalendarItemDTO[] = drafts.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: row.type,
    status: row.status,
    date: dayKey(row.updatedAt),
    publishedAt: null,
    wordCount: row.wordCount,
    href: `/dashboard/content/${row.id}`,
  }));

  const items = [...publishedItems, ...draftItems].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
  );
  const publishedDates = publishedItems.map((item) => item.date);

  return {
    month: month.key,
    label: month.label,
    prevMonth: shiftMonth(month.key, -1),
    nextMonth: shiftMonth(month.key, 1),
    cells: buildMonthCells(month, items, now),
    items,
    stats: {
      publishedCount: publishedItems.length,
      chapterCount: publishedItems.filter((item) => item.type === 'CHAPTER').length,
      draftCount: draftItems.length,
      publishDays: distinctDays(publishedDates),
      longestStreak: longestStreak(publishedDates),
      totalWords: publishedItems.reduce((sum, item) => sum + item.wordCount, 0),
      lastPublishedAt: lastPublished?.publishedAt?.toISOString() ?? null,
      daysSinceLastPublish: lastPublished?.publishedAt
        ? daysBetween(lastPublished.publishedAt, now)
        : null,
    },
  };
}
