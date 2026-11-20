import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { signSessionToken, verifySessionToken } from '@/lib/auth/token';

const SECRET = 'unit-test-secret-at-least-16-chars';
const payload = { sub: 'user_1', email: 'owner@example.com', role: 'OWNER' as const };

describe('signSessionToken / verifySessionToken', () => {
  it('round-trips a signed session', async () => {
    const token = await signSessionToken(payload, SECRET);
    expect(token.split('.')).toHaveLength(3);
    await expect(verifySessionToken(token, SECRET)).resolves.toEqual(payload);
  });

  it('keeps the EDITOR role', async () => {
    const editor = { ...payload, role: 'EDITOR' as const };
    const token = await signSessionToken(editor, SECRET);
    await expect(verifySessionToken(token, SECRET)).resolves.toEqual(editor);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSessionToken(payload, SECRET);
    await expect(verifySessionToken(token, 'another-secret-at-least-16')).resolves.toBeNull();
  });

  it('rejects a tampered signature', async () => {
    const token = await signSessionToken(payload, SECRET);
    const [header = '', body = '', signature = ''] = token.split('.');
    await expect(
      verifySessionToken(`${header}.${body}.${signature.slice(0, -2)}xx`, SECRET),
    ).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signSessionToken(payload, SECRET, -10);
    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it('rejects a token missing the email claim', async () => {
    const token = await new SignJWT({ role: 'OWNER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user_1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });
});
