import { describe, expect, it } from 'vitest';
import {
  canTransition,
  contentMetrics,
  deriveExcerpt,
  normalizeSlugParam,
  normalizeTags,
  slugCandidate,
  tagSlug,
} from '@/lib/content/domain';

describe('canTransition', () => {
  it('允许草稿直接发布，也允许幂等的同状态操作', () => {
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(true);
    expect(canTransition('PUBLISHED', 'PUBLISHED')).toBe(true);
  });

  it('归档内容必须先回到草稿，不能直接发布', () => {
    expect(canTransition('ARCHIVED', 'PUBLISHED')).toBe(false);
    expect(canTransition('ARCHIVED', 'DRAFT')).toBe(true);
  });

  it('已发布内容可以下线或重新进入评审', () => {
    expect(canTransition('PUBLISHED', 'DRAFT')).toBe(true);
    expect(canTransition('PUBLISHED', 'REVIEW')).toBe(true);
  });
});

describe('deriveExcerpt', () => {
  it('优先使用显式摘要', () => {
    expect(deriveExcerpt('# 正文', '  自定义摘要  ')).toBe('自定义摘要');
  });

  it('去掉 Markdown 标记并压平空白', () => {
    const md = '# 标题\n\n这是 **加粗** 与 [链接](https://example.com) 的段落。';
    expect(deriveExcerpt(md)).toBe('标题 这是 加粗 与 链接 的段落。');
  });

  it('超长内容截断并加省略号', () => {
    const result = deriveExcerpt('字'.repeat(300), undefined, 40);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(41);
  });
});

describe('normalizeTags', () => {
  it('支持逗号与顿号，去重并限量', () => {
    expect(normalizeTags('Next.js, 架构、Next.js，测试')).toEqual(['Next.js', '架构', '测试']);
  });

  it('数组输入同样生效', () => {
    expect(normalizeTags(['a', ' a ', '', 'b'], 2)).toEqual(['a', 'b']);
  });
});

describe('slug helpers', () => {
  it('第一次尝试给干净 slug，之后追加后缀', () => {
    expect(slugCandidate('Building Lumen', 0, 'abcdef')).toBe('building-lumen');
    expect(slugCandidate('Building Lumen', 1, 'abcdef')).toBe('building-lumen-abcdef');
  });

  it('标签 slug 稳定且不同名称不冲突', () => {
    expect(tagSlug('Next.js')).toBe(tagSlug('Next.js'));
    expect(tagSlug('Next.js')).not.toBe(tagSlug('NextJS'));
  });

  it('解码 percent-encoded 参数，但不破坏已是中文的 slug', () => {
    expect(normalizeSlugParam('chinese-slug-%E4%B8%AD%E6%96%87')).toBe('chinese-slug-中文');
    expect(normalizeSlugParam('chinese-slug-中文')).toBe('chinese-slug-中文');
    expect(normalizeSlugParam('%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('contentMetrics', () => {
  it('中英混排都计入且至少 1 分钟', () => {
    const { words, minutes } = contentMetrics('中文五个字 and some english words');
    expect(words).toBeGreaterThan(5);
    expect(minutes).toBe(1);
  });
});
