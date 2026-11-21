import Link from 'next/link';
import { ContentCard } from '@/components/content-card';
import { listQuerySchema } from '@/lib/content/validation';
import { listPublished, listTags } from '@/server/services/content.service';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '文章',
  description: 'Lumen 上已发布的技术文章、小说章节与学习笔记。',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pageHref(page: number, type?: string, tag?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (type) params.set('type', type);
  if (tag) params.set('tag', tag);
  return `/posts?${params.toString()}`;
}

export default async function PostsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const parsed = listQuerySchema.safeParse({
    page: sp.page,
    pageSize: sp.pageSize ?? '10',
    type: sp.type,
    tag: sp.tag,
  });
  const query = parsed.success ? parsed.data : listQuerySchema.parse({});

  let result;
  let tags: { name: string; slug: string; count: number }[] = [];
  try {
    [result, tags] = await Promise.all([listPublished(query), listTags()]);
  } catch {
    return (
      <div className="rounded-xl border border-amber-600/30 bg-amber-50 p-5 text-sm text-amber-900">
        数据库暂时不可用，无法加载文章列表。
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">文章</h1>
      <p className="mb-6 text-sm text-black/55">共 {result.total} 篇已发布内容</p>

      {tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/posts"
            className={`rounded-full border px-3 py-1 text-xs ${
              query.tag ? 'border-black/15 bg-white text-black/60' : 'border-ink bg-ink text-white'
            }`}
          >
            全部
          </Link>
          {tags.map((tag) => (
            <Link
              key={tag.slug}
              href={`/tags/${tag.slug}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                query.tag === tag.slug
                  ? 'border-ink bg-ink text-white'
                  : 'border-black/15 bg-white text-black/60 hover:border-black/40'
              }`}
            >
              #{tag.name} · {tag.count}
            </Link>
          ))}
        </div>
      )}

      {result.items.length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-white p-8 text-center text-sm text-black/50">
          这里还没有已发布的内容。
        </div>
      ) : (
        <div className="grid gap-4">
          {result.items.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {(query.page > 1 || result.page * result.pageSize < result.total) && (
        <div className="mt-6 flex gap-3 text-sm">
          {query.page > 1 && (
            <Link
              href={pageHref(query.page - 1, query.type, query.tag)}
              className="rounded-lg border border-black/15 bg-white px-4 py-2"
            >
              上一页
            </Link>
          )}
          {result.page * result.pageSize < result.total && (
            <Link
              href={pageHref(query.page + 1, query.type, query.tag)}
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
