'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type MeResponse = { user: { email: string; name: string | null } };

/** 放在 root layout：客户端探测会话，避免把整站变成动态渲染。 */
export function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me')
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setEmail(null);
          return;
        }
        const data = (await response.json()) as MeResponse;
        if (active) setEmail(data.user.email);
      })
      .catch(() => {
        if (active) setEmail(null);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setEmail(null);
    setBusy(false);
    router.push('/');
    router.refresh();
  }

  if (email === undefined) return null;

  if (email === null) {
    return (
      <Link href="/login" className="hover:text-black/90">
        登录
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <span className="max-w-[160px] truncate">{email}</span>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="hover:text-black/90 disabled:opacity-60"
      >
        退出
      </button>
    </span>
  );
}
