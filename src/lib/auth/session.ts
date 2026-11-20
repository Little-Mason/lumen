import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import {
  signSessionToken,
  verifySessionToken,
  SESSION_TTL_SECONDS,
  type SessionPayload,
} from '@/lib/auth/token';

export type { SessionPayload } from '@/lib/auth/token';

export function createSessionToken(payload: SessionPayload): Promise<string> {
  return signSessionToken(payload, env.AUTH_SECRET);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(env.AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token, env.AUTH_SECRET);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
};

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(env.AUTH_COOKIE_NAME, token, sessionCookieOptions);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(env.AUTH_COOKIE_NAME);
}
