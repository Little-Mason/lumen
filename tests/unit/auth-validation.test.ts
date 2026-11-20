import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '@/lib/auth/validation';

describe('registerSchema', () => {
  it('normalises the email and defaults the invite code', () => {
    const parsed = registerSchema.parse({
      email: '  Owner@Example.COM ',
      password: 'password123',
    });
    expect(parsed.email).toBe('owner@example.com');
    expect(parsed.inviteCode).toBe('');
  });

  it('rejects malformed email and short password', () => {
    expect(() => registerSchema.parse({ email: 'nope', password: 'password123' })).toThrow();
    expect(() => registerSchema.parse({ email: 'a@b.com', password: 'short' })).toThrow();
  });

  it('rejects a password beyond the bcrypt 72-byte limit', () => {
    expect(() => registerSchema.parse({ email: 'a@b.com', password: 'x'.repeat(73) })).toThrow();
  });

  it('trims the optional name', () => {
    const parsed = registerSchema.parse({
      email: 'a@b.com',
      password: 'password123',
      name: '  Mason  ',
    });
    expect(parsed.name).toBe('Mason');
  });
});

describe('loginSchema', () => {
  it('does not leak the registration password policy', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('still requires an email and a non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});
