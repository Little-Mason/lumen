import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { estimateCostCents } from '@/lib/ai/client';
import { aiCacheKey, getCached, setCached } from '@/lib/ai/cache';
import { AiError } from '@/lib/ai/errors';
import { mockCompletion } from '@/lib/ai/mock';
import { buildPrompt, SYSTEM_PROMPT, type PromptContext } from '@/lib/ai/prompts';
import { activeModel, complete, streamCompletion, withDeadline } from '@/lib/ai/provider';
import { assertAiQuota } from '@/lib/ai/rate-limit';
import { sseResponse, type SseEvent } from '@/lib/sse';
import type { AiServiceInput, AiUsage, RagSource } from '@/lib/ai/types';
import type { AiJobDTO, AiJobKind, AiJobResult, AiJobStatus, Paginated } from '@/types';

/**
 * AI 编排层：prompt 组装 → 限流/预算 → 模型调用 → token/成本/延迟记账 → 缓存。
 * Route Handler 不直接调模型；流式与非流式共用同一套 AiJob 生命周期。
 */

type Prepared = {
  jobId: string;
  model: string;
  kind: AiJobKind;
  system: string;
  prompt: string;
  mockText: string;
  cacheKey: string;
  sources: RagSource[];
  started: number;
};

function safeMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return '未知错误';
}

function sourceDto(source: RagSource) {
  return {
    contentId: source.contentId,
    chunkIndex: source.chunkIndex,
    title: source.title,
    slug: source.slug,
    similarity: Number(source.similarity.toFixed(4)),
    preview: source.text.slice(0, 180),
  };
}

async function prepare(userId: string, input: AiServiceInput): Promise<Prepared> {
  await assertAiQuota(userId);

  let title = '未命名内容';
  let contentType: PromptContext['contentType'] = 'NOTE';
  if (input.contentId) {
    const content = await db.content.findFirst({
      where: { id: input.contentId, authorId: userId },
      select: { title: true, type: true },
    });
    if (!content) throw new AiError('NOT_FOUND', '内容不存在或无权访问');
    title = content.title;
    contentType = content.type;
  }

  const ctx: PromptContext = {
    title,
    contentType,
    body: input.body,
    extra: input.extra,
  };
  const sources = input.sources ?? [];
  const prompt = buildPrompt(input.kind, ctx);
  const mockText = mockCompletion(input.kind, { ...ctx, sources });
  const model = activeModel();

  const job = await db.aiJob.create({
    data: {
      userId,
      contentId: input.contentId ?? null,
      kind: input.kind,
      model,
      status: 'PENDING',
    },
    select: { id: true },
  });

  return {
    jobId: job.id,
    model,
    kind: input.kind,
    system: SYSTEM_PROMPT,
    prompt,
    mockText,
    cacheKey: aiCacheKey(input.kind, input.contentId, input.body, input.extra),
    sources,
    started: Date.now(),
  };
}

async function finishSuccess(
  prepared: Prepared,
  text: string,
  usage: AiUsage,
): Promise<AiJobResult> {
  // mock: 前缀只是记账标记，计价仍按配置的真实模型口径估算。
  const modelForPricing = prepared.model.replace(/^mock:/, '');
  const costCents = estimateCostCents(modelForPricing, usage.promptTokens, usage.completionTokens);
  const latencyMs = Date.now() - prepared.started;
  await db.aiJob.update({
    where: { id: prepared.jobId },
    data: {
      status: 'SUCCESS',
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      costCents,
      latencyMs,
    },
  });
  return {
    jobId: prepared.jobId,
    kind: prepared.kind,
    text,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    costCents,
    latencyMs,
  };
}

/** 失败也必须留痕：看板要能查到错误与耗时，且不能因为记账失败掩盖原错误。 */
async function finishFailure(prepared: Prepared, error: unknown): Promise<void> {
  try {
    await db.aiJob.update({
      where: { id: prepared.jobId },
      data: {
        status: 'FAILED',
        error: safeMessage(error).slice(0, 500),
        latencyMs: Date.now() - prepared.started,
      },
    });
  } catch (dbError) {
    logger.error('ai job failure record failed', { jobId: prepared.jobId, error: String(dbError) });
  }
  logger.error('ai job failed', {
    jobId: prepared.jobId,
    kind: prepared.kind,
    error: safeMessage(error),
  });
}

export async function runAiJob(userId: string, input: AiServiceInput): Promise<AiJobResult> {
  // 缓存命中不消耗配额、不创建 AiJob；RAG 问答带实时检索结果，不缓存。
  if (input.kind !== 'RAG_ASK') {
    const key = aiCacheKey(input.kind, input.contentId, input.body, input.extra);
    const hit = getCached(key);
    if (hit) return { ...hit, cached: true };
  }

  const prepared = await prepare(userId, input);
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= env.AI_MAX_RETRIES; attempt += 1) {
    const deadline = withDeadline();
    try {
      const result = await complete({
        system: prepared.system,
        prompt: prepared.prompt,
        mockText: prepared.mockText,
        signal: deadline.signal,
      });
      const finished = await finishSuccess(prepared, result.text, result.usage);
      if (prepared.kind !== 'RAG_ASK') setCached(prepared.cacheKey, finished);
      return finished;
    } catch (error) {
      lastError = error;
      if (attempt < env.AI_MAX_RETRIES) {
        logger.warn('ai attempt failed, retrying', {
          jobId: prepared.jobId,
          attempt,
          error: safeMessage(error),
        });
      }
    } finally {
      deadline.clear();
    }
  }

  await finishFailure(prepared, lastError);
  throw new AiError('PROVIDER_ERROR', `AI 暂不可用：${safeMessage(lastError)}`);
}

async function* streamEvents(prepared: Prepared, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  yield {
    event: 'meta',
    data: {
      jobId: prepared.jobId,
      kind: prepared.kind,
      model: prepared.model,
      sources: prepared.sources.map(sourceDto),
    },
  };

  const deadline = withDeadline(signal);
  let text = '';
  try {
    const streaming = streamCompletion({
      system: prepared.system,
      prompt: prepared.prompt,
      mockText: prepared.mockText,
      signal: deadline.signal,
    });
    for await (const chunk of streaming.chunks) {
      text += chunk;
      yield { event: 'delta', data: { text: chunk } };
    }
    const usage = await streaming.usage();
    const result = await finishSuccess(prepared, text, usage);
    yield {
      event: 'done',
      data: { result, sources: prepared.sources.map(sourceDto) },
    };
  } catch (error) {
    await finishFailure(prepared, error);
    yield {
      event: 'error',
      data: { code: 'PROVIDER_ERROR', message: safeMessage(error) },
    };
  } finally {
    deadline.clear();
  }
}

/** 流式调用返回 SSE Response；校验/配额/建 Job 在返回响应前完成，便于报错走正常 HTTP 状态。 */
export async function streamAiJob(
  userId: string,
  input: AiServiceInput,
  signal?: AbortSignal,
): Promise<Response> {
  const prepared = await prepare(userId, input);
  return sseResponse(streamEvents(prepared, signal));
}

export type AiJobQuery = {
  page: number;
  pageSize: number;
  kind?: AiJobKind;
  status?: AiJobStatus;
};

export async function listAiJobs(userId: string, query: AiJobQuery): Promise<Paginated<AiJobDTO>> {
  const where = {
    userId,
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [rows, total] = await Promise.all([
    db.aiJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        kind: true,
        status: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        costCents: true,
        latencyMs: true,
        error: true,
        createdAt: true,
        content: { select: { title: true } },
      },
    }),
    db.aiJob.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      model: row.model,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      costCents: row.costCents,
      latencyMs: row.latencyMs,
      error: row.error,
      contentTitle: row.content?.title ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}
