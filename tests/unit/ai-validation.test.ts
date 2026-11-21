import { describe, expect, it } from 'vitest';
import { aiJobsQuerySchema, ragAskSchema, runAiSchema } from '@/lib/ai/validation';

describe('runAiSchema', () => {
  it('接受合法请求，stream 默认 false', () => {
    const parsed = runAiSchema.parse({ kind: 'POLISH', body: '正文' });
    expect(parsed.stream).toBe(false);
    expect(parsed.kind).toBe('POLISH');
  });

  it('拒绝空正文、超长正文与未知能力', () => {
    expect(runAiSchema.safeParse({ kind: 'TAGS', body: '' }).success).toBe(false);
    expect(runAiSchema.safeParse({ kind: 'TAGS', body: 'x'.repeat(50_001) }).success).toBe(false);
    expect(runAiSchema.safeParse({ kind: 'NOPE', body: '正文' }).success).toBe(false);
  });

  it('RAG_ASK 不允许从写作接口调用', () => {
    expect(runAiSchema.safeParse({ kind: 'RAG_ASK', body: '问题' }).success).toBe(false);
  });
});

describe('ragAskSchema', () => {
  it('默认流式，问题必填且长度受限', () => {
    expect(ragAskSchema.parse({ question: '问题' }).stream).toBe(true);
    expect(ragAskSchema.safeParse({ question: '' }).success).toBe(false);
    expect(ragAskSchema.safeParse({ question: 'x'.repeat(1001) }).success).toBe(false);
  });
});

describe('aiJobsQuerySchema', () => {
  it('分页有默认值且上限 50', () => {
    expect(aiJobsQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 });
    expect(aiJobsQuerySchema.parse({ page: '3', pageSize: '10' })).toMatchObject({
      page: 3,
      pageSize: 10,
    });
    expect(aiJobsQuerySchema.safeParse({ pageSize: '51' }).success).toBe(false);
  });
});
