import { NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/auth/session';
import { apiError, authFailure, readJson } from '@/lib/http';
import { verifyCredentials } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/** POST /api/auth/login — 失败统一 401，不区分用户是否存在。 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body === null) return apiError(400, 'INVALID_INPUT', '请求体必须是合法 JSON');

  try {
    const user = await verifyCredentials(body);
    if (!user) return apiError(401, 'INVALID_CREDENTIALS', '邮箱或密码不正确');
    await setSessionCookie({ sub: user.id, email: user.email, role: user.role });
    return NextResponse.json({ user });
  } catch (error) {
    return authFailure(error);
  }
}
