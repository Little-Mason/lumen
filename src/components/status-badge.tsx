import type { ContentStatus, ContentType } from '@/types';

const STATUS_STYLE: Record<ContentStatus, string> = {
  DRAFT: 'border-black/15 bg-black/[0.03] text-black/60',
  REVIEW: 'border-amber-600/30 bg-amber-50 text-amber-900',
  PUBLISHED: 'border-emerald-600/25 bg-emerald-50 text-emerald-900',
  ARCHIVED: 'border-black/10 bg-black/[0.02] text-black/45',
};

const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: '草稿',
  REVIEW: '评审中',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
};

export const TYPE_LABEL: Record<ContentType, string> = {
  ARTICLE: '文章',
  CHAPTER: '章节',
  NOTE: '笔记',
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
