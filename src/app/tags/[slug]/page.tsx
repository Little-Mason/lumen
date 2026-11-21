import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentCard } from '@/components/content-card';
import { normalizeSlugParam } from '@/lib/content/domain';
import { listPublished, listTags } from '@/server/services/content.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = normalizeSlugParam(slug);
  const tags = await listTags().catch(() => []);
  const tag = tags.find((item) => item.slug === decoded);
  return {
    title: tag ? `#${tag.name}` : '标签',
    description: tag ? `标签 ${tag.name} 下的已发布内容` : undefined,
  };
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = normalizeSlugParam(slug);
  const [tags, result] = await Promise.all([
    listTags(),
    listPublished({ tag: decoded, pageSize: 50 }).catch(() => null),
  ]);
  const tag = tags.find((item) => item.slug === decoded);
  if (!tag || !result) notFound();

  return (
    <div>
      <Link href="/posts" className="text-sm text-black/45 hover:text-black/80">
        ← 全部文章
      </Link>
      <h1 className="mb-2 mt-4 text-3xl font-semibold tracking-tight">#{tag.name}</h1>
      <p className="mb-6 text-sm text-black/55">{result.total} 篇已发布内容</p>
      {result.items.length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-white p-8 text-center text-sm text-black/50">
          这个标签下暂时没有内容。
        </div>
      ) : (
        <div className="grid gap-4">
          {result.items.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
