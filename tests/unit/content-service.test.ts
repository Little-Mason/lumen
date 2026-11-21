import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    content: { findUnique: mocks.findUnique, create: mocks.create },
    tag: { upsert: mocks.upsert },
  },
}));

import { createContent } from '@/server/services/content.service';

type CreateData = {
  title: string;
  slug: string;
  status: string;
  authorId: string;
  wordCount: number;
  readingMinutes: number;
  excerpt: string | null;
  tags: { connect: { id: string }[] };
};

const createdData = () => mocks.create.mock.calls[0]?.[0]?.data as CreateData;

describe('content.service / createContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockImplementation(async ({ where }: { where: { name: string } }) => ({
      id: `tag-${where.name}`,
    }));
    mocks.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'content-1',
      type: data.type,
      status: 'DRAFT',
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      contentMd: data.contentMd,
      coverUrl: data.coverUrl,
      wordCount: data.wordCount,
      readingMinutes: data.readingMinutes,
      publishedAt: null,
      updatedAt: new Date('2026-11-21T00:00:00Z'),
      createdAt: new Date('2026-11-21T00:00:00Z'),
      viewCount: 0,
      authorId: data.authorId,
      tags: [],
      author: { name: null },
    }));
  });

  it('建草稿时算好 slug、字数、阅读时长、摘要与去重标签', async () => {
    const dto = await createContent(
      {
        title: '  从零搭一个内容中枢  ',
        contentMd: '# 标题\n\n这是 **正文**，包含一些中文与 English words。',
        tags: '架构, Next.js、架构',
      },
      'user-1',
    );

    const data = createdData();
    expect(data.title).toBe('从零搭一个内容中枢');
    expect(data.status).toBe('DRAFT');
    expect(data.authorId).toBe('user-1');
    expect(data.slug).toBe('从零搭一个内容中枢');
    expect(data.wordCount).toBeGreaterThan(0);
    expect(data.readingMinutes).toBe(1);
    expect(data.excerpt).toContain('正文');
    expect(data.tags.connect).toHaveLength(2);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);

    expect(dto.id).toBe('content-1');
    expect(dto.status).toBe('DRAFT');
    expect(dto.publishedAt).toBeNull();
  });

  it('slug 冲突时追加后缀重试', async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValue(null);
    await createContent({ title: '重复标题', contentMd: '正文' }, 'user-1');
    const data = createdData();
    expect(data.slug).toMatch(/^重复标题-[a-z0-9]{6}$/);
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
  });

  it('显式摘要优先于自动提取', async () => {
    await createContent(
      { title: '标题', contentMd: '正文内容', excerpt: '我自己写的摘要' },
      'user-1',
    );
    const data = createdData();
    expect(data.excerpt).toBe('我自己写的摘要');
  });
});
