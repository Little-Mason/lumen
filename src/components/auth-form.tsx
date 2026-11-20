'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'login' | 'register';

const field =
  'w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/50';

export function AuthForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const body =
      mode === 'register'
        ? { email, password, name: name || undefined, inviteCode }
        : { email, password };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(data.error?.message ?? '操作失败，请稍后重试');
        setPending(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('网络错误，请稍后重试');
      setPending(false);
    }
  }

  function switchMode() {
    setMode((current) => (current === 'login' ? 'register' : 'login'));
    setError(null);
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium">
              昵称（可选）
            </label>
            <input
              id="name"
              type="text"
              autoComplete="nickname"
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            邮箱
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className={field}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            密码
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className={field}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {mode === 'register' && (
          <div>
            <label htmlFor="inviteCode" className="mb-1 block text-sm font-medium">
              邀请码
            </label>
            <input
              id="inviteCode"
              type="text"
              className={field}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            <p className="mt-1 text-xs text-black/45">首个账号无需邀请码，之后必填。</p>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? '处理中…' : mode === 'login' ? '登录' : '创建账号'}
        </button>
      </form>

      <button
        type="button"
        onClick={switchMode}
        className="mt-4 w-full text-center text-sm text-black/55 hover:text-black/80"
      >
        {mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}
      </button>
    </div>
  );
}
