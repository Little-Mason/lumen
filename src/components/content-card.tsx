import Link from 'next/link';
import { TYPE_LABEL } from '@/components/status-badge';
import type { ContentListItemDTO } from '@/types';

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function ContentCard({ item }: { item: ContentListItemDTO }) {
  const date = item.publishedAt ? new Date(item.publishedAt) : new Date(item.updatedAt);

  return (
    <Link
      href={`/posts/${item.slug}`}
      className="block rounded-xl border border-black/10 bg-white p-5 transition-colors hover:border-black/30"
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-black/45">
        <span className="font-medium text-accent">{TYPE_LABEL[item.type]}</span>
        <span>·</span>
        <span>{dateFormatter.format(date)}</span>
        <span>·</span>
        <span>{item.readingMinutes} 分钟</span>
      </div>
      <h2 className="mb-2 text-lg font-semibold tracking-tight">{item.title}</h2>
      {item.excerpt && <p className="mb-3 text-sm leading-6 text-black/60">{item.excerpt}</p>}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded bg-black/[0.04] px-2 py-0.5 text-xs text-black/55">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
