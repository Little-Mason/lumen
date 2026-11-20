import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth/token';

/**
 * 只做「会话有没有」的判断，不查库、不碰 bcrypt：
 * middleware 跑在 Edge Runtime，必须保持纯 JWT 校验。
 * 业务权限仍在 service 层判定，这里只是把未登录的人挡在门外的第一道闸。
 */
export async function middleware(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const cookieName = process.env.AUTH_COOKIE_NAME || 'lumen_session';
  const token = request.cookies.get(cookieName)?.value;
  const session = token && secret ? await verifySessionToken(token, secret) : null;

  const { pathname, search } = request.nextUrl;

  if (!session && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // 已登录的人不必再看登录页，直接回工作台（保留 ?next 由登录页自己读）。
  if (session && pathname === '/login' && !request.nextUrl.searchParams.has('next')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/login'],
};
