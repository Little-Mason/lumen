import { AuthForm } from '@/components/auth-form';

export const metadata = { title: '登录' };

type Props = {
  searchParams: Promise<{ next?: string }>;
};

/** next 由服务端读取并做开放重定向防护，避免客户端 useSearchParams 的 Suspense 要求。 */
export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">登录 Lumen</h1>
      <p className="mb-6 text-sm leading-6 text-black/55">
        工作台需要登录。第一个账号自动成为 OWNER；之后的账号需要邀请码。
      </p>
      <AuthForm next={safeNext} />
      <p className="mt-4 text-xs leading-5 text-black/45">
        会话存放在 httpOnly Cookie 中，有效期 7 天。失败信息不区分「邮箱不存在」与「密码错误」。
      </p>
    </div>
  );
}
