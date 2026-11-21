import { createHash } from 'node:crypto';
import type { AiJobKind } from '@/types';
import type { AiJobResult } from '@/types';

/** 非流式结果缓存：同样的正文 + 能力重复点击不再花钱。进程内，重启即失效。 */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

type Entry = { value: AiJobResult; expiresAt: number };
const store = new Map<string, Entry>();

export function aiCacheKey(
  kind: AiJobKind,
  contentId: string | undefined,
  body: string,
  extra?: string,
): string {
  return createHash('sha256')
    .update(kind)
    .update('\u0000')
    .update(contentId ?? '')
    .update('\u0000')
    .update(body)
    .update('\u0000')
    .update(extra ?? '')
    .digest('hex');
}

export function getCached(key: string, now = Date.now()): AiJobResult | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCached(
  key: string,
  value: AiJobResult,
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now(),
): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: now + ttlMs });
}

export const clearAiCache = () => store.clear();
