import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** POST /api/auth/logout — 幂等：无论是否登录都清 Cookie。 */
export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
