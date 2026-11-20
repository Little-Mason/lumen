import { NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/auth/session';
import { apiError, authFailure, readJson } from '@/lib/http';
import { registerUser } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/** POST /api/auth/register — 首个账号为 OWNER 且无需邀请码，之后必须带邀请码。 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body === null) return apiError(400, 'INVALID_INPUT', '请求体必须是合法 JSON');

  try {
    const user = await registerUser(body);
    await setSessionCookie({ sub: user.id, email: user.email, role: user.role });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return authFailure(error);
  }
}
