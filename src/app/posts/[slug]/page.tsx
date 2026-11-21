import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TYPE_LABEL } from '@/components/status-badge';
import { normalizeSlugParam } from '@/lib/content/domain';
import { getPublishedBySlug } from '@/server/services/content.service';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBySlug(normalizeSlugParam(slug)).catch(() => null);
  if (!post) return { title: '文章不存在' };

  return {
    title: post.title,
    description: post.excerpt ?? `${post.title} · Lumen`,
    alternates: { canonical: `/posts/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt ?? undefined,
      publishedTime: post.publishedAt ?? undefined,
      tags: post.tags,
    },
  };
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params;
  const post = await getPublishedBySlug(normalizeSlugParam(slug));
  if (!post) notFound();

  const published = post.publishedAt
    ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date(post.publishedAt))
    : null;

  return (
    <article className="prose-lumen mx-auto max-w-3xl">
      <Link href="/posts" className="text-sm text-black/45 hover:text-black/80">
        ← 全部文章
      </Link>
      <p className="mb-2 mt-6 text-sm text-black/40">
        {TYPE_LABEL[post.type]} · {post.readingMinutes} 分钟 · {post.wordCount} 字
        {post.authorName && ` · ${post.authorName}`}
        {published && ` · ${published}`}
      </p>
      <h1>{post.title}</h1>
      {post.excerpt && <p className="text-black/50">{post.excerpt}</p>}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.contentMd}</ReactMarkdown>
      {post.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2 border-t border-black/10 pt-4">
          {post.tags.map((tag) => (
            <span key={tag} className="rounded bg-black/[0.04] px-2 py-1 text-xs text-black/55">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
