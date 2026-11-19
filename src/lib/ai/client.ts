import { createOpenAI } from '@ai-sdk/openai';
import { env } from '@/lib/env';

/**
 * Provider 抽象：聊天与 embedding 分开配置。
 * DeepSeek 兼容 OpenAI 协议但没有 embedding 接口，所以必须是两个 baseURL。
 * 换供应商只改 .env，不改业务代码。
 */
export const chatProvider = createOpenAI({
  baseURL: env.AI_BASE_URL,
  apiKey: env.AI_API_KEY,
  compatibility: 'compatible',
});

export const embeddingProvider = createOpenAI({
  baseURL: env.EMBEDDING_BASE_URL,
  apiKey: env.EMBEDDING_API_KEY,
  compatibility: 'compatible',
});

export const chatModel = () => chatProvider(env.AI_MODEL);
export const embeddingModel = () => embeddingProvider.textEmbeddingModel(env.EMBEDDING_MODEL);

/** 粗略成本表（分 / 1K tokens），用于 AiJob.costCents 与预算告警，非账单口径。 */
const PRICE_PER_1K: Record<string, { in: number; out: number }> = {
  'deepseek-chat': { in: 0.1, out: 0.3 },
  'gpt-4o-mini': { in: 1.1, out: 4.4 },
  'text-embedding-3-small': { in: 0.15, out: 0 },
};

export function estimateCostCents(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = PRICE_PER_1K[model] ?? { in: 1, out: 3 };
  return Math.ceil((promptTokens / 1000) * p.in + (completionTokens / 1000) * p.out);
}
