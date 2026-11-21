import { listPublishedSummaries } from '@/server/services/content.service';

export const dynamic = 'force-dynamic';

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}

/** GET /rss.xml — 输出最近 50 篇已发布内容。 */
export async function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const posts = (await listPublishedSummaries().catch(() => [])).slice(0, 50);

  const items = posts.map((post) =>
    [
      '    <item>',
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(`${base}/posts/${post.slug}`)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(`${base}/posts/${post.slug}`)}</guid>`,
      `      <description>${escapeXml(post.excerpt ?? post.title)}</description>`,
      `      <pubDate>${(post.publishedAt ?? post.updatedAt).toUTCString()}</pubDate>`,
      '    </item>',
    ].join('\n'),
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>Lumen · AI 内容中枢</title>',
    `    <link>${escapeXml(base)}</link>`,
    '    <description>技术文章、小说章节与学习笔记</description>',
    '    <language>zh-CN</language>',
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
