import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { AuthError } from '@/lib/auth/errors';
import { loginSchema, registerSchema } from '@/lib/auth/validation';

/** 认证业务编排：Route Handler 不直接碰 Prisma 与 bcrypt。 */

const BCRYPT_ROUNDS = 10;

// 用户不存在时也做一次真实 bcrypt 比较，避免用响应时间枚举邮箱。
// 这是 bcrypt.hashSync('timing-safe-placeholder', 10) 的固定产物，无实际账号。
const DUMMY_HASH = '$2a$10$WPUwzs//yaHb1J4IVFeVUODGJ0NDKHqxo.iCfubIi10DAXHq84oaS';

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'OWNER' | 'EDITOR';
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: 'OWNER' | 'EDITOR';
};

const toPublicUser = (user: UserRow): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role === 'EDITOR' ? 'EDITOR' : 'OWNER',
});

export async function registerUser(raw: unknown): Promise<PublicUser> {
  const input = registerSchema.parse(raw);
  const userCount = await db.user.count();

  if (userCount > 0) {
    if (!env.AUTH_INVITE_CODE || input.inviteCode !== env.AUTH_INVITE_CODE) {
      throw new AuthError('INVITE_REQUIRED', '注册已关闭，需要有效的邀请码。');
    }
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  try {
    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        passwordHash,
        role: userCount === 0 ? 'OWNER' : 'EDITOR',
      },
    });
    return toPublicUser(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AuthError('EMAIL_TAKEN', '该邮箱已被注册。');
    }
    throw error;
  }
}

/** 失败一律返回 null：不区分「邮箱不存在」与「密码错误」。 */
export async function verifyCredentials(raw: unknown): Promise<PublicUser | null> {
  const input = loginSchema.parse(raw);
  const user = await db.user.findUnique({ where: { email: input.email } });
  const matched = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matched) return null;
  return toPublicUser(user);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await db.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}
