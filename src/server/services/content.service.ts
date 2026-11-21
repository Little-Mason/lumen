import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { ContentError } from '@/lib/content/errors';
import {
  canTransition,
  contentMetrics,
  deriveExcerpt,
  normalizeTags,
  slugCandidate,
  tagSlug,
} from '@/lib/content/domain';
import { createContentSchema, updateContentSchema, type ListQuery } from '@/lib/content/validation';
import type {
  ContentDetailDTO,
  ContentListItemDTO,
  ContentStatus,
  ContentType,
  Paginated,
  TagDTO,
} from '@/types';

/** 内容服务：Route Handler / RSC 共用，UI 层不直接碰 Prisma。 */

type ListRow = {
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
  viewCount: number;
  tags: { name: string }[];
  author: { name: string | null };
};

type DetailRow = ListRow & {
  contentMd: string;
  coverUrl: string | null;
  authorId: string;
  createdAt: Date;
};

const listSelect = {
  id: true,
  type: true,
  status: true,
  title: true,
  slug: true,
  excerpt: true,
  wordCount: true,
  readingMinutes: true,
  publishedAt: true,
  updatedAt: true,
  viewCount: true,
  tags: { select: { name: true } },
  author: { select: { name: true } },
} satisfies Prisma.ContentSelect;

const detailSelect = {
  id: true,
  type: true,
  status: true,
  title: true,
  slug: true,
  excerpt: true,
  wordCount: true,
  readingMinutes: true,
  publishedAt: true,
  updatedAt: true,
  viewCount: true,
  tags: { select: { name: true } },
  author: { select: { name: true } },
  contentMd: true,
  coverUrl: true,
  authorId: true,
  createdAt: true,
} satisfies Prisma.ContentSelect;

const toListItem = (c: ListRow): ContentListItemDTO => ({
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
  viewCount: c.viewCount,
  tags: c.tags.map((tag) => tag.name),
  authorName: c.author.name,
});

const toDetail = (c: DetailRow): ContentDetailDTO => ({
  ...toListItem(c),
  contentMd: c.contentMd,
  coverUrl: c.coverUrl,
  authorId: c.authorId,
  createdAt: c.createdAt.toISOString(),
});

function buildWhere(
  query: Partial<ListQuery>,
  base: Prisma.ContentWhereInput,
): Prisma.ContentWhereInput {
  return {
    ...base,
    ...(query.type ? { type: query.type } : {}),
    ...(query.tag ? { tags: { some: { slug: query.tag } } } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { excerpt: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

function clampPage(page?: number, pageSize?: number) {
  return {
    page: Math.max(1, page ?? 1),
    pageSize: Math.min(50, Math.max(1, pageSize ?? 10)),
  };
}

/** 公开列表：只读已发布内容。 */
export async function listPublished(query: Partial<ListQuery> = {}) {
  const { page, pageSize } = clampPage(query.page, query.pageSize);
  const where = buildWhere(query, { status: 'PUBLISHED' });
  const [rows, total] = await Promise.all([
    db.content.findMany({
      where,
      select: listSelect,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.content.count({ where }),
  ]);
  return { items: rows.map(toListItem), page, pageSize, total };
}

/** 后台列表：只看自己的内容，可按状态、类型、标签、关键词筛选。 */
export async function listForAuthor(
  authorId: string,
  query: Partial<ListQuery> = {},
): Promise<Paginated<ContentListItemDTO>> {
  const { page, pageSize } = clampPage(query.page, query.pageSize);
  const where = buildWhere(query, {
    authorId,
    ...(query.status ? { status: query.status } : {}),
  });
  const [rows, total] = await Promise.all([
    db.content.findMany({
      where,
      select: listSelect,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.content.count({ where }),
  ]);
  return { items: rows.map(toListItem), page, pageSize, total };
}

/** 公开详情：未发布内容对匿名访问一律视为 404。 */
export async function getPublishedBySlug(slug: string): Promise<ContentDetailDTO | null> {
  const row = await db.content.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: detailSelect,
  });
  return row ? toDetail(row) : null;
}

/** 供编辑器加载：必须登录且是作者本人。 */
export async function getOwnedById(id: string, actorId: string): Promise<ContentDetailDTO> {
  const row = await db.content.findUnique({ where: { id }, select: detailSelect });
  if (!row) throw new ContentError('NOT_FOUND', '内容不存在');
  if (row.authorId !== actorId) throw new ContentError('FORBIDDEN', '只能操作自己的内容');
  return toDetail(row);
}

async function ensureTags(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const tag = await db.tag.upsert({
      where: { name },
      update: {},
      create: { name, slug: tagSlug(name) },
    });
    ids.push(tag.id);
  }
  return ids;
}

async function uniqueSlug(title: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = slugCandidate(title, attempt, randomBytes(4).toString('hex'));
    const existing = await db.content.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new ContentError('SLUG_TAKEN', '无法生成唯一 slug，请换一个标题');
}

export async function createContent(raw: unknown, authorId: string): Promise<ContentDetailDTO> {
  const input = createContentSchema.parse(raw);
  const slug = await uniqueSlug(input.title);
  const tagIds = await ensureTags(normalizeTags(input.tags));
  const { words, minutes } = contentMetrics(input.contentMd);

  const row = await db.content.create({
    data: {
      authorId,
      title: input.title,
      contentMd: input.contentMd,
      type: input.type,
      slug,
      status: 'DRAFT',
      excerpt: deriveExcerpt(input.contentMd, input.excerpt),
      coverUrl: input.coverUrl ?? null,
      wordCount: words,
      readingMinutes: minutes,
      tags: { connect: tagIds.map((id) => ({ id })) },
    },
    select: detailSelect,
  });
  return toDetail(row);
}

export async function updateContent(
  id: string,
  raw: unknown,
  actorId: string,
): Promise<ContentDetailDTO> {
  const input = updateContentSchema.parse(raw);
  const current = await getOwnedById(id, actorId);

  if (input.status && !canTransition(current.status, input.status)) {
    throw new ContentError(
      'INVALID_TRANSITION',
      `不能从 ${current.status} 直接变为 ${input.status}`,
    );
  }

  const markdown = input.contentMd ?? current.contentMd;
  const metrics = input.contentMd !== undefined ? contentMetrics(markdown) : null;

  const data: Prisma.ContentUpdateInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.contentMd !== undefined ? { contentMd: input.contentMd } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(metrics ? { wordCount: metrics.words, readingMinutes: metrics.minutes } : {}),
    ...(input.excerpt !== undefined
      ? { excerpt: input.excerpt?.trim() || null }
      : input.contentMd !== undefined
        ? { excerpt: deriveExcerpt(markdown) }
        : {}),
    ...(input.status === 'PUBLISHED' && current.status !== 'PUBLISHED'
      ? { publishedAt: new Date() }
      : {}),
    ...(input.tags !== undefined
      ? {
          tags: {
            set: (await ensureTags(normalizeTags(input.tags))).map((tagId) => ({ id: tagId })),
          },
        }
      : {}),
  };

  const row = await db.content.update({ where: { id }, data, select: detailSelect });
  return toDetail(row);
}

async function changeStatus(
  id: string,
  actorId: string,
  next: ContentStatus,
): Promise<ContentDetailDTO> {
  const current = await getOwnedById(id, actorId);
  if (current.status === next) return current;
  if (!canTransition(current.status, next)) {
    throw new ContentError('INVALID_TRANSITION', `不能从 ${current.status} 直接变为 ${next}`);
  }
  const row = await db.content.update({
    where: { id },
    data: {
      status: next,
      ...(next === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
    },
    select: detailSelect,
  });
  return toDetail(row);
}

export const publishContent = (id: string, actorId: string) =>
  changeStatus(id, actorId, 'PUBLISHED');

export const unpublishContent = (id: string, actorId: string) => changeStatus(id, actorId, 'DRAFT');

/** 软删除：归档而不是物理删除，保留历史与 AI 记账外键。 */
export const archiveContent = (id: string, actorId: string) =>
  changeStatus(id, actorId, 'ARCHIVED');

export async function listTags(): Promise<TagDTO[]> {
  const tags = await db.tag.findMany({
    orderBy: { name: 'asc' },
    select: {
      name: true,
      slug: true,
      contents: { where: { status: 'PUBLISHED' }, select: { id: true } },
    },
  });
  return tags.map((tag) => ({ name: tag.name, slug: tag.slug, count: tag.contents.length }));
}

export type PublishedSummary = {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

/** sitemap / RSS 用：一次取全量已发布内容的轻量字段。 */
export async function listPublishedSummaries(limit = 500): Promise<PublishedSummary[]> {
  return db.content.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
}

// 切片与向量索引的维护在 rag.service.ts / index-sync.ts，
// 由 publish / unpublish / PATCH / archive 的 Route Handler 显式调用，
// 内容服务本身只负责内容模型，避免发布流程被 embedding 失败阻断。

export type WritableContent = { id: string; title: string; contentMd: string };

/** AI 工作台「从已有内容载入」下拉框，只取当前用户未归档内容的正文。 */
export async function listWritableContents(userId: string, limit = 20): Promise<WritableContent[]> {
  return db.content.findMany({
    where: { authorId: userId, status: { not: 'ARCHIVED' } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: { id: true, title: true, contentMd: true },
  });
}
