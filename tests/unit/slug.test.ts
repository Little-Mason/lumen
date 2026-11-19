import { describe, expect, it } from 'vitest';
import { countWords, slugify } from '@/lib/utils/slug';

describe('slugify', () => {
  it('把英文标题转成连字符形式', () => {
    expect(slugify('  Building Lumen, v0.1! ')).toBe('building-lumen-v0-1');
  });

  it('保留中文', () => {
    expect(slugify('第一章 起稿')).toBe('第一章-起稿');
  });

  it('空输入有稳定兜底', () => {
    expect(slugify('!!!')).toBe('untitled');
    expect(slugify('')).toBe('untitled');
  });
});

describe('countWords', () => {
  it('中英混排都计入，并给出至少 1 分钟', () => {
    const { words, minutes } = countWords('中文五个字 and some english words');
    expect(words).toBeGreaterThan(5);
    expect(minutes).toBe(1);
  });
});
