import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getBySlug } from '@/server/services/content.service';

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBySlug(slug);
  if (!post || post.status !== 'PUBLISHED') notFound();

  return (
    <article className="prose-lumen mx-auto max-w-3xl">
      <p className="mb-2 text-sm text-black/40">
        {post.type} · {post.readingMinutes} 分钟 · {post.wordCount} 字
      </p>
      <h1>{post.title}</h1>
      {post.excerpt && <p className="text-black/50">{post.excerpt}</p>}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.contentMd}</ReactMarkdown>
    </article>
  );
}
