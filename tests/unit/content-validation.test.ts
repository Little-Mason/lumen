import { describe, expect, it } from 'vitest';
import {
  createContentSchema,
  listQuerySchema,
  updateContentSchema,
} from '@/lib/content/validation';

describe('createContentSchema', () => {
  it('默认类型为 ARTICLE，标题去空格', () => {
    const parsed = createContentSchema.parse({ title: '  Hello  ', contentMd: '# Hi' });
    expect(parsed.title).toBe('Hello');
    expect(parsed.type).toBe('ARTICLE');
  });

  it('拒绝空正文与非法 URL', () => {
    expect(createContentSchema.safeParse({ title: 'x', contentMd: '' }).success).toBe(false);
    expect(
      createContentSchema.safeParse({ title: 'x', contentMd: 'y', coverUrl: 'not-a-url' }).success,
    ).toBe(false);
  });
});

describe('updateContentSchema', () => {
  it('拒绝空对象，避免无意义更新', () => {
    expect(updateContentSchema.safeParse({}).success).toBe(false);
  });

  it('接受局部更新与合法状态', () => {
    expect(updateContentSchema.safeParse({ title: 'new', status: 'REVIEW' }).success).toBe(true);
    expect(updateContentSchema.safeParse({ status: 'BOGUS' }).success).toBe(false);
  });
});

describe('listQuerySchema', () => {
  it('把字符串查询参数强制转成数字并给默认值', () => {
    const parsed = listQuerySchema.parse({ page: '3', pageSize: '25' });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(25);
  });

  it('pageSize 上限 50', () => {
    expect(listQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('默认第一页十条', () => {
    expect(listQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 10 });
  });
});
