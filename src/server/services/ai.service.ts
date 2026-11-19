import { generateText } from 'ai';
import { db } from '@/lib/db';
import { chatModel, estimateCostCents } from '@/lib/ai/client';
import { buildPrompt, SYSTEM_PROMPT } from '@/lib/ai/prompts';
import type { PromptContext } from '@/lib/ai/prompts';
import { logger } from '@/lib/logger';
import type { AiJobRequest, AiJobResult } from '@/types';

/**
 * AI 编排层：统一负责 prompt 组装、模型调用、token/成本/延迟记账、失败留痕。
 * 任何 Route Handler 都不直接调模型，便于后续加缓存、限流、队列与重试。
 */
export async function runAiJob(userId: string, req: AiJobRequest): Promise<AiJobResult> {
  const started = Date.now();
  const content = req.contentId
    ? await db.content.findUnique({ where: { id: req.contentId } })
    : null;

  const ctx: PromptContext = {
    title: content?.title ?? '未命名内容',
    contentType: (content?.type ?? 'NOTE') as PromptContext['contentType'],
    body: req.body,
    extra: req.extra,
  };

  const job = await db.aiJob.create({
    data: { userId, contentId: content?.id, kind: req.kind, model: process.env.AI_MODEL ?? 'deepseek-chat', status: 'PENDING' },
  });

  try {
    const result = await generateText({
      model: chatModel(),
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(req.kind, ctx),
    });

    const promptTokens = result.usage?.promptTokens ?? 0;
    const completionTokens = result.usage?.completionTokens ?? 0;
    const costCents = estimateCostCents(job.model, promptTokens, completionTokens);
    const latencyMs = Date.now() - started;

    await db.aiJob.update({
      where: { id: job.id },
      data: {
        status: 'SUCCESS',
        promptTokens,
        completionTokens,
        costCents,
        latencyMs,
      },
    });

    return {
      jobId: job.id,
      kind: req.kind,
      text: result.text,
      promptTokens,
      completionTokens,
      costCents,
      latencyMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    await db.aiJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', error: message.slice(0, 500), latencyMs: Date.now() - started },
    });
    logger.error('ai job failed', { jobId: job.id, kind: req.kind, message });
    throw err;
  }
}

/** RAG 问答契约（W3）：embed 问题 → pgvector 余弦检索 → 带片段回答 → SSE 流式返回。 */
export async function ragAsk(_question: string): Promise<AsyncIterable<string>> {
  throw new Error('W3 milestone: embed -> hnsw search -> rerank -> stream');
}
