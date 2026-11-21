import { listPublishedSummaries, listTags } from '@/server/services/content.service';

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

const iso = (value: Date | null) => (value ?? new Date()).toISOString();

/** GET /sitemap.xml — 由 Route Handler 生成，避免构建期连库。 */
export async function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const [posts, tags] = await Promise.all([
    listPublishedSummaries().catch(() => []),
    listTags().catch(() => []),
  ]);

  const entries = [
    { path: '/', lastmod: posts[0]?.publishedAt ?? null },
    { path: '/posts', lastmod: posts[0]?.publishedAt ?? null },
    ...posts.map((post) => ({
      path: `/posts/${post.slug}`,
      lastmod: post.updatedAt,
    })),
    ...tags.map((tag) => ({ path: `/tags/${tag.slug}`, lastmod: null })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (entry) =>
        `  <url><loc>${escapeXml(`${base}${entry.path}`)}</loc><lastmod>${iso(entry.lastmod)}</lastmod></url>`,
    ),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
