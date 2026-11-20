import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/session';
import { apiError, authFailure } from '@/lib/http';
import { getUserById } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/** GET /api/auth/me — 以数据库为准，账号被删后旧 JWT 也会失效。 */
export async function GET() {
  const session = await readSession();
  if (!session) return apiError(401, 'UNAUTHORIZED', '未登录或会话已过期');

  try {
    const user = await getUserById(session.sub);
    if (!user) return apiError(401, 'UNAUTHORIZED', '账号不存在或已被删除');
    return NextResponse.json({ user });
  } catch (error) {
    return authFailure(error);
  }
}
