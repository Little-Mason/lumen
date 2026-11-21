import { z } from 'zod';

/** 写作台五种能力；RAG_ASK 走独立的 /api/ai/ask，不在这里暴露。 */
export const WRITING_KINDS = ['OUTLINE', 'TITLE', 'TAGS', 'SUMMARIZE', 'POLISH'] as const;

export const runAiSchema = z.object({
  kind: z.enum(WRITING_KINDS),
  contentId: z.string().min(1).max(64).optional(),
  body: z.string().min(1, '正文不能为空').max(50_000, '正文过长'),
  extra: z.string().max(2000).optional(),
  stream: z.boolean().optional().default(false),
});
export type RunAiInput = z.infer<typeof runAiSchema>;

export const ragAskSchema = z.object({
  question: z.string().min(1, '问题不能为空').max(1000),
  contentId: z.string().min(1).max(64).optional(),
  stream: z.boolean().optional().default(true),
});
export type RagAskInput = z.infer<typeof ragAskSchema>;

export const aiJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  kind: z.enum(['OUTLINE', 'TITLE', 'TAGS', 'SUMMARIZE', 'POLISH', 'RAG_ASK']).optional(),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED']).optional(),
});
