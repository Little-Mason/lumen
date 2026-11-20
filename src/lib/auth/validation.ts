import { z } from 'zod';

/** 入参校验统一放这里，Route Handler 只负责解析与映射状态码。 */

const email = z.string().trim().toLowerCase().min(1, '请输入邮箱').email('邮箱格式不正确').max(254);
const password = z.string().min(8, '密码至少 8 位').max(72, '密码最多 72 位（bcrypt 上限）');

export const registerSchema = z.object({
  email,
  password,
  name: z.string().trim().min(1, '昵称不能为空').max(60, '昵称最多 60 字').optional(),
  inviteCode: z.string().trim().optional().default(''),
});

export const loginSchema = z.object({
  email,
  // 登录阶段不暴露密码策略细节，只要求非空。
  password: z.string().min(1, '请输入密码').max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
