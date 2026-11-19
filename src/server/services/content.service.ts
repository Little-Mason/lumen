import { ContentStatus, ContentType, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { countWords, slugify } from '@/lib/utils/slug';
import type { ContentDTO, Paginated } from '@/types';

/** 内容服务：Route Handler / Server Action 共用，UI 层不直接碰 Prisma。 */

const toDTO = (c: {
  id: string;
  type: ContentType;
  status: ContentStatus;
  title: string;
  slug: string;
  excerpt: string | null;
  wordCount: number;
  readingMinutes: number;
  publishedAt: Date | null;
  updatedAt: Date;
}): ContentDTO => ({
  id: c.id,
  type: c.type,
  status: c.status,
  title: c.title,
  slug: c.slug,
  excerpt: c.excerpt,
  wordCount: c.wordCount,
  readingMinutes: c.readingMinutes,
  publishedAt: c.publishedAt?.toISOString() ?? null,
  updatedAt: c.updatedAt.toISOString(),
});

export async function listPublished(params: {
  page?: number;
  pageSize?: number;
  type?: ContentType;
}): Promise<Paginated<ContentDTO>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 10));
  const where: Prisma.ContentWhereInput = { status: 'PUBLISHED', ...(params.type ? { type: params.type } : {}) };

  const [rows, total] = await Promise.all([
    db.content.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.content.count({ where }),
  ]);

  return { items: rows.map(toDTO), page, pageSize, total };
}

export async function getBySlug(slug: string) {
  return db.content.findUnique({ where: { slug }, include: { tags: true, author: { select: { name: true } } } });
}

export async function createDraft(input: {
  authorId: string;
  title: string;
  contentMd: string;
  type: ContentType;
}) {
  const { words, minutes } = countWords(input.contentMd);
  const base = slugify(input.title);
  const slug = `${base}-${Date.now().toString(36).slice(-4)}`;

  return db.content.create({
    data: {
      ...input,
      slug,
      status: 'DRAFT',
      wordCount: words,
      readingMinutes: minutes,
    },
  });
}

export async function publish(id: string) {
  return db.content.update({
    where: { id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });
}

/** 发布/编辑后调用：重新切片并生成向量，供 RAG 使用（W3 实现）。 */
export async function reindexContent(_contentId: string): Promise<void> {
  throw new Error('W3 milestone: chunk + embed + upsert ContentChunk');
}
