import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StatusBadge, TYPE_LABEL } from '@/components/status-badge';
import { readSession } from '@/lib/auth/session';
import { listQuerySchema } from '@/lib/content/validation';
import { listForAuthor } from '@/server/services/content.service';
import type { ContentStatus } from '@/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: '内容' };

const FILTERS: { label: string; value?: ContentStatus }[] = [
  { label: '全部' },
  { label: '草稿', value: 'DRAFT' },
  { label: '评审中', value: 'REVIEW' },
  { label: '已发布', value: 'PUBLISHED' },
  { label: '已归档', value: 'ARCHIVED' },
];

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function linkFor(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/dashboard/content?${query}` : '/dashboard/content';
}

export default async function ContentPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await readSession();
  if (!session) redirect('/login?next=/dashboard/content');

  const sp = await searchParams;
  const parsed = listQuerySchema.safeParse({
    page: sp.page,
    pageSize: sp.pageSize ?? '20',
    type: sp.type,
    status: sp.status,
    tag: sp.tag,
    q: sp.q,
  });
  const query = parsed.success ? parsed.data : listQuerySchema.parse({ pageSize: '20' });

  let result;
  try {
    result = await listForAuthor(session.sub, query);
  } catch {
    return (
      <div className="rounded-xl border border-amber-600/30 bg-amber-50 p-5 text-sm text-amber-900">
        数据库暂时不可用，无法加载内容列表。请确认 PostgreSQL 正在运行后刷新。
      </div>
    );
  }

  const base = {
    type: query.type,
    tag: query.tag,
    q: query.q,
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">内容</h1>
          <p className="mt-1 text-sm text-black/55">
            共 {result.total} 篇 · 技术文章、小说章节与学习笔记共用同一个内容模型
          </p>
        </div>
        <Link
          href="/dashboard/content/new"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white"
        >
          新建内容
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          const active = query.status === filter.value;
          return (
            <Link
              key={filter.label}
              href={linkFor({ ...base, status: filter.value })}
              className={`rounded-full border px-3 py-1 text-xs ${
                active
                  ? 'border-ink bg-ink text-white'
                  : 'border-black/15 bg-white text-black/60 hover:border-black/40'
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <form action="/dashboard/content" method="get" className="mb-5 flex flex-wrap gap-2">
        {query.status && <input type="hidden" name="status" value={query.status} />}
        <input
          type="search"
          name="q"
          defaultValue={query.q ?? ''}
          placeholder="搜索标题或摘要"
          className="w-64 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/50"
        />
        <select
          name="type"
          defaultValue={query.type ?? ''}
          className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
        >
          <option value="">全部类型</option>
          <option value="ARTICLE">文章</option>
          <option value="CHAPTER">章节</option>
          <option value="NOTE">笔记</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm hover:border-black/40"
        >
          筛选
        </button>
      </form>

      {result.items.length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-white p-8 text-center text-sm text-black/50">
          还没有符合条件的内容。
          <Link href="/dashboard/content/new" className="ml-1 text-accent hover:underline">
            写第一篇
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
          {result.items.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/content/${item.id}`}
              className="flex flex-wrap items-center gap-3 border-b border-black/[0.06] px-4 py-3 last:border-b-0 hover:bg-black/[0.02]"
            >
              <span className="min-w-[180px] flex-1 text-sm font-medium">{item.title}</span>
              <StatusBadge status={item.status} />
              <span className="text-xs text-black/45">{TYPE_LABEL[item.type]}</span>
              <span className="text-xs text-black/40">{item.wordCount} 字</span>
              <span className="text-xs text-black/40">
                {dateFormatter.format(new Date(item.updatedAt))}
              </span>
              <span className="flex gap-1">
                {item.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-black/[0.04] px-2 py-0.5 text-xs text-black/50"
                  >
                    #{tag}
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </div>
      )}

      {(query.page > 1 || result.page * result.pageSize < result.total) && (
        <div className="mt-4 flex gap-3 text-sm">
          {query.page > 1 && (
            <Link
              href={linkFor({ ...base, status: query.status, page: String(query.page - 1) })}
              className="rounded-lg border border-black/15 bg-white px-4 py-2"
            >
              上一页
            </Link>
          )}
          {result.page * result.pageSize < result.total && (
            <Link
              href={linkFor({ ...base, status: query.status, page: String(query.page + 1) })}
              className="rounded-lg border border-black/15 bg-white px-4 py-2"
            >
              下一页
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
