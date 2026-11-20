import { SignJWT, jwtVerify } from 'jose';

/**
 * 纯 JWT 逻辑：不依赖 next/headers、Prisma 或环境变量，
 * 因此 Route Handler / Server Component / Edge Middleware 都能安全 import。
 */
export type SessionPayload = {
  sub: string;
  email: string;
  role: 'OWNER' | 'EDITOR';
};

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const encodeKey = (secret: string) => new TextEncoder().encode(secret);

export async function signSessionToken(
  payload: SessionPayload,
  secret: string,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttlSeconds)
    .sign(encodeKey(secret));
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodeKey(secret), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role === 'EDITOR' ? 'EDITOR' : 'OWNER',
    };
  } catch {
    return null;
  }
}
