import type { AiJobKind } from '@/types';

/** 一条可回溯到公开文章的检索片段。 */
export type RagSource = {
  contentId: string;
  chunkIndex: number;
  text: string;
  title: string;
  slug: string;
  similarity: number;
};

/** ai.service 的统一入参，Route Handler 校验完 Zod 后传入。 */
export type AiServiceInput = {
  kind: AiJobKind;
  body: string;
  extra?: string;
  contentId?: string;
  sources?: RagSource[];
};

export type AiUsage = { promptTokens: number; completionTokens: number };
