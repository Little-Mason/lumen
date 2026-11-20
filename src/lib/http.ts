import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/auth/errors';
import { logger } from '@/lib/logger';

/** 全站统一错误结构，与 docs/API.md 的 ApiError 契约一致。 */
export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message, requestId: randomUUID() } }, { status });
}

/** JSON 解析失败返回 null，避免 500 泄漏堆栈。 */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

/** 认证接口的统一异常映射：Zod → 400，领域错误 → 403/409，其余记日志并返回 500。 */
export function authFailure(error: unknown) {
  if (error instanceof ZodError) {
    return apiError(400, 'INVALID_INPUT', error.issues[0]?.message ?? '入参不合法');
  }
  if (error instanceof AuthError) {
    return apiError(error.code === 'EMAIL_TAKEN' ? 409 : 403, error.code, error.message);
  }
  logger.error('auth request failed', { error: String(error) });
  return apiError(500, 'INTERNAL_ERROR', '服务暂时不可用，请稍后重试');
}
