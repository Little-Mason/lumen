import { beforeEach, describe, expect, it } from 'vitest';
import { aiCacheKey, clearAiCache, getCached, setCached } from '@/lib/ai/cache';
import type { AiJobResult } from '@/types';

const result: AiJobResult = {
  jobId: 'job-1',
  kind: 'SUMMARIZE',
  text: '摘要',
  promptTokens: 10,
  completionTokens: 5,
  costCents: 1,
  latencyMs: 2,
};

describe('AI 结果缓存', () => {
  beforeEach(() => clearAiCache());

  it('key 由 kind + contentId + 正文 + extra 决定，且稳定', () => {
    const a = aiCacheKey('TAGS', 'c1', '正文');
    expect(a).toBe(aiCacheKey('TAGS', 'c1', '正文'));
    expect(a).not.toBe(aiCacheKey('TITLE', 'c1', '正文'));
    expect(a).not.toBe(aiCacheKey('TAGS', 'c1', '别的正文'));
    expect(a).not.toBe(aiCacheKey('TAGS', undefined, '正文'));
    expect(a).not.toBe(aiCacheKey('TAGS', 'c1', '正文', '额外要求'));
    expect(a).toHaveLength(64);
  });

  it('命中返回同一结果，过期后自动失效', () => {
    const key = aiCacheKey('SUMMARIZE', undefined, '正文');
    expect(getCached(key, 1000)).toBeNull();
    setCached(key, result, 500, 1000);
    expect(getCached(key, 1200)).toEqual(result);
    expect(getCached(key, 1600)).toBeNull();
  });

  it('clear 之后不再命中', () => {
    const key = aiCacheKey('POLISH', undefined, '正文');
    setCached(key, result);
    clearAiCache();
    expect(getCached(key)).toBeNull();
  });
});
