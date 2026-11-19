import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

export type SessionPayload = {
  sub: string;
  email: string;
  role: 'OWNER' | 'EDITOR';
};

const key = new TextEncoder().encode(env.AUTH_SECRET);
const TTL = '7d';

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(key);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(env.AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key);
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role === 'EDITOR' ? 'EDITOR' : 'OWNER',
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};
