import { embedMany, generateText, streamText } from 'ai';
import { chatModel, embeddingModel } from '@/lib/ai/client';
import { env } from '@/lib/env';
import { AiError } from '@/lib/ai/errors';
import { estimateTokens, mockEmbedding } from '@/lib/ai/mock';
import type { AiUsage } from '@/lib/ai/types';

/** 数据库 vector(1536) 列的维度；换 embedding 模型必须同步改 schema 与索引。 */
export const VECTOR_DIM = 1536;

export const isMockProvider = () => env.AI_PROVIDER === 'mock';

/** AiJob.model 记录真实使用的模型，mock 模式加前缀便于看板区分。 */
export const activeModel = () => (isMockProvider() ? `mock:${env.AI_MODEL}` : env.AI_MODEL);

export type CompletionInput = {
  system: string;
  prompt: string;
  mockText: string;
  signal?: AbortSignal;
};

async function mockDelay(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new AiError('PROVIDER_ERROR', 'AI 生成已取消');
  if (env.AI_MOCK_LATENCY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, env.AI_MOCK_LATENCY_MS));
  }
  if (signal?.aborted) throw new AiError('PROVIDER_ERROR', 'AI 生成已取消');
}

async function* mockChunks(text: string, signal?: AbortSignal): AsyncGenerator<string> {
  const step = 24;
  for (let offset = 0; offset < text.length; offset += step) {
    await mockDelay(signal);
    yield text.slice(offset, offset + step);
  }
}

/** 内部 deadline 与调用方 signal 合并，覆盖整次非流式调用或整条流。 */
export function withDeadline(signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('AI_TIMEOUT')), env.AI_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

export async function complete(input: CompletionInput): Promise<{ text: string; usage: AiUsage }> {
  if (isMockProvider()) {
    await mockDelay(input.signal);
    return {
      text: input.mockText,
      usage: {
        promptTokens: estimateTokens(input.prompt),
        completionTokens: estimateTokens(input.mockText),
      },
    };
  }

  const result = await generateText({
    model: chatModel(),
    system: input.system,
    prompt: input.prompt,
    abortSignal: input.signal,
    maxRetries: 0,
  });
  return {
    text: result.text,
    usage: {
      promptTokens: result.usage?.promptTokens ?? 0,
      completionTokens: result.usage?.completionTokens ?? 0,
    },
  };
}

export function streamCompletion(input: CompletionInput): {
  chunks: AsyncIterable<string>;
  usage: () => Promise<AiUsage>;
} {
  if (isMockProvider()) {
    return {
      chunks: mockChunks(input.mockText, input.signal),
      usage: async () => ({
        promptTokens: estimateTokens(input.prompt),
        completionTokens: estimateTokens(input.mockText),
      }),
    };
  }

  const result = streamText({
    model: chatModel(),
    system: input.system,
    prompt: input.prompt,
    abortSignal: input.signal,
    maxRetries: 0,
  });
  return {
    chunks: result.textStream,
    usage: async () => {
      const usage = await result.usage;
      return {
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
      };
    },
  };
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (env.EMBEDDING_DIM !== VECTOR_DIM) {
    throw new AiError(
      'DIM_MISMATCH',
      `EMBEDDING_DIM=${env.EMBEDDING_DIM} 与数据库 vector(${VECTOR_DIM}) 不一致，请先改 schema、索引并重建切片表`,
    );
  }
  if (texts.length === 0) return [];
  if (isMockProvider()) return texts.map((text) => mockEmbedding(text, VECTOR_DIM));

  const { embeddings } = await embedMany({
    model: embeddingModel(),
    values: texts,
    maxRetries: 0,
  });
  if (embeddings.some((vector) => vector.length !== VECTOR_DIM)) {
    throw new AiError('DIM_MISMATCH', '供应商返回的向量维度与数据库不一致');
  }
  return embeddings;
}
