import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  aiJobCreate: vi.fn(),
  aiJobUpdate: vi.fn(),
  contentFindFirst: vi.fn(),
  assertQuota: vi.fn(),
  complete: vi.fn(),
  estimateCostCents: vi.fn(() => 1),
}));

vi.mock('@/lib/db', () => ({
  db: {
    aiJob: { create: mocks.aiJobCreate, update: mocks.aiJobUpdate },
    content: { findFirst: mocks.contentFindFirst },
  },
}));
vi.mock('@/lib/ai/rate-limit', () => ({ assertAiQuota: mocks.assertQuota }));
vi.mock('@/lib/ai/client', () => ({ estimateCostCents: mocks.estimateCostCents }));
vi.mock('@/lib/ai/provider', () => ({
  activeModel: () => 'mock:deepseek-chat',
  complete: mocks.complete,
  streamCompletion: vi.fn(),
  withDeadline: () => ({ signal: new AbortController().signal, clear: () => undefined }),
}));
vi.mock('@/lib/env', () => ({ env: { AI_MAX_RETRIES: 1 } }));

import { clearAiCache } from '@/lib/ai/cache';
import { AiError } from '@/lib/ai/errors';
import { runAiJob } from '@/server/services/ai.service';

describe('ai.service / runAiJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAiCache();
    mocks.assertQuota.mockResolvedValue(undefined);
    mocks.aiJobCreate.mockResolvedValue({ id: 'job-1' });
    mocks.aiJobUpdate.mockResolvedValue({});
    mocks.contentFindFirst.mockResolvedValue(null);
    mocks.estimateCostCents.mockReturnValue(1);
    mocks.complete.mockResolvedValue({
      text: '生成结果',
      usage: { promptTokens: 10, completionTokens: 4 },
    });
  });

  it('成功路径：先建 PENDING，再写 SUCCESS 的 token / 成本 / 耗时', async () => {
    const result = await runAiJob('user-1', { kind: 'SUMMARIZE', body: '正文' });

    expect(result.text).toBe('生成结果');
    expect(result.jobId).toBe('job-1');
    expect(result.costCents).toBe(1);
    expect(mocks.aiJobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          kind: 'SUMMARIZE',
          status: 'PENDING',
          model: 'mock:deepseek-chat',
        }),
      }),
    );
    expect(mocks.aiJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'SUCCESS',
          promptTokens: 10,
          completionTokens: 4,
          costCents: 1,
        }),
      }),
    );
    expect(mocks.estimateCostCents).toHaveBeenCalledWith('deepseek-chat', 10, 4);
  });

  it('相同入参命中缓存：不重复调用模型、不重复建 Job', async () => {
    await runAiJob('user-1', { kind: 'TAGS', body: '同一段正文' });
    const second = await runAiJob('user-1', { kind: 'TAGS', body: '同一段正文' });

    expect(second.cached).toBe(true);
    expect(second.text).toBe('生成结果');
    expect(mocks.complete).toHaveBeenCalledTimes(1);
    expect(mocks.aiJobCreate).toHaveBeenCalledTimes(1);
  });

  it('RAG_ASK 带实时检索结果，不缓存', async () => {
    await runAiJob('user-1', { kind: 'RAG_ASK', body: '问题', extra: '片段' });
    await runAiJob('user-1', { kind: 'RAG_ASK', body: '问题', extra: '片段' });
    expect(mocks.complete).toHaveBeenCalledTimes(2);
    expect(mocks.aiJobCreate).toHaveBeenCalledTimes(2);
  });

  it('失败重试耗尽后写 FAILED 并抛 PROVIDER_ERROR', async () => {
    mocks.complete.mockRejectedValue(new Error('provider down'));

    await expect(runAiJob('user-1', { kind: 'POLISH', body: '正文' })).rejects.toBeInstanceOf(
      AiError,
    );
    expect(mocks.complete).toHaveBeenCalledTimes(2); // 首次 + 1 次重试
    expect(mocks.aiJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', error: 'provider down' }),
      }),
    );
  });

  it('contentId 指向不存在或他人的内容时抛 NOT_FOUND，不建 Job', async () => {
    await expect(
      runAiJob('user-1', { kind: 'TAGS', body: 'x', contentId: 'foreign' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.aiJobCreate).not.toHaveBeenCalled();
  });

  it('配额被拒时不进入模型调用', async () => {
    mocks.assertQuota.mockRejectedValue(new AiError('RATE_LIMITED', '太频繁', 60));
    await expect(runAiJob('user-1', { kind: 'TITLE', body: '正文' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
