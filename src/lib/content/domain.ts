/** 内容领域纯函数：不碰 Prisma、不碰 process.env，可直接单测。 */
import { countWords, slugify } from '@/lib/utils/slug';
import type { ContentStatus } from '@/types';

export const CONTENT_TYPES = ['ARTICLE', 'CHAPTER', 'NOTE'] as const;
export const CONTENT_STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;

/** 状态流转白名单：同状态视为幂等；ARCHIVED 只能先回到 DRAFT。 */
const TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ['REVIEW', 'PUBLISHED', 'ARCHIVED'],
  REVIEW: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'REVIEW', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/** 从 Markdown 生成摘要：去标题标记、链接语法与代码块，压空白后截断。 */
export function deriveExcerpt(markdown: string, provided?: string | null, limit = 160): string {
  if (provided && provided.trim()) return provided.trim().slice(0, limit);

  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_`>~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= limit) return plain;
  return `${plain.slice(0, limit).trimEnd()}…`;
}

/** 标签输入归一化：支持逗号/顿号分隔，去重、限长、限量。 */
export function normalizeTags(input: string[] | string | undefined, max = 8): string[] {
  const raw = Array.isArray(input) ? input : (input ?? '').split(/[,，、]/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const name = item.trim().slice(0, 24);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    result.push(name);
    if (result.length >= max) break;
  }
  return result;
}

/** 稳定短哈希，用于生成不会互相撞车的标签 slug。 */
function shortHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 6).padEnd(6, '0');
}

export function tagSlug(name: string): string {
  return `${slugify(name)}-${shortHash(name.toLowerCase())}`;
}

/** 第 0 次尝试用干净 slug，之后追加短随机后缀以避开唯一索引冲突。 */
export function slugCandidate(title: string, attempt: number, suffix: string): string {
  const base = slugify(title).slice(0, 72);
  if (attempt === 0) return base;
  return `${base}-${suffix.slice(0, 6)}`;
}

export function contentMetrics(markdown: string) {
  return countWords(markdown);
}

/**
 * Next.js 动态路由参数可能保留 percent-encoding（中文 slug 尤其明显）。
 * 只在确实含 %HH 时解码，避免把已经是中文的字符串二次解码弄坏。
 */
export function normalizeSlugParam(raw: string): string {
  if (!/%[0-9a-fA-F]{2}/.test(raw)) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
