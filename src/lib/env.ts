import { z } from 'zod';

/**
 * 只许在服务端 import。CI 构建时注入占位值，运行时由部署环境注入真实值。
 * 环境变量集中校验，避免「跑起来才报错」。
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET 至少 16 位'),
  AUTH_COOKIE_NAME: z.string().default('lumen_session'),
  // 空字符串 = 关闭注册（首个账号之后必须凭邀请码才能创建用户）。
  AUTH_INVITE_CODE: z.string().default(''),

  AI_BASE_URL: z.string().url().default('https://api.deepseek.com/v1'),
  AI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('deepseek-chat'),

  EMBEDDING_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  EMBEDDING_API_KEY: z.string().default(''),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIM: z.coerce.number().int().positive().default(1536),

  // mock 是默认值：没有密钥也能跑完整 AI 闭环，CI 不消耗真实 token。
  // 填入 AI_API_KEY / EMBEDDING_API_KEY 后把此值改为 openai-compatible 即可切真模型。
  AI_PROVIDER: z.enum(['mock', 'openai-compatible']).default('mock'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  AI_MOCK_LATENCY_MS: z.coerce.number().int().min(0).max(2000).default(0),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
  CHUNK_SIZE: z.coerce.number().int().min(200).max(2000).default(700),
  CHUNK_OVERLAP: z.coerce.number().int().min(0).max(300).default(80),

  AI_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(20),
  AI_MONTHLY_BUDGET_CENTS: z.coerce.number().int().positive().default(3000),
  REDIS_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);

export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
};
