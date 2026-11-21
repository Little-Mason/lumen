import { z } from 'zod';

/** GET /api/ai/usage 的查询参数；最多回看 90 天，防止一次拉全表。 */
export const usageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

export type UsageQuery = z.infer<typeof usageQuerySchema>;
