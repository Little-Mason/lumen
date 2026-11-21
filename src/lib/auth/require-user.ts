import { readSession, type SessionPayload } from '@/lib/auth/session';
import { getUserById } from '@/server/services/auth.service';
import { ContentError } from '@/lib/content/errors';

/**
 * 写接口统一入口：不仅校验 JWT，还确认账号仍在库中。
 * 删号后旧 JWT 立即失效，与 /api/auth/me 的行为一致。
 */
export async function requireUser(): Promise<SessionPayload> {
  const session = await readSession();
  if (!session) throw new ContentError('UNAUTHORIZED', '请先登录');
  const user = await getUserById(session.sub);
  if (!user) throw new ContentError('UNAUTHORIZED', '会话已失效，请重新登录');
  return session;
}
