/** 生成 URL slug：保留中英文与数字，空格/标点转连字符；全空时给稳定兜底。 */
export function slugify(input: string): string {
  const parts = input
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .match(/[\p{L}\p{N}]+/gu);

  if (!parts || parts.length === 0) return 'untitled';

  const slug = parts.join('-').slice(0, 80).replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'untitled';
}

/** 中文按字、英文按词估算字数，用于阅读时长与进度统计。 */
export function countWords(markdown: string): { words: number; minutes: number } {
  const cjk = (markdown.match(/[\p{Script=Han}]/gu) ?? []).length;
  const latin = (markdown.match(/[A-Za-z0-9]+/g) ?? []).length;
  const words = cjk + latin;
  return { words, minutes: Math.max(1, Math.ceil(words / 400)) };
}
