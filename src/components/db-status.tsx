'use client';

import { useEffect, useState } from 'react';

type Health = { status: string; db: string };

/** 运行时探测 /api/health，避免构建期连库，也不会把「库没起」伪装成空数据。 */
export function DbStatus() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((res) => res.json() as Promise<Health>)
      .then((data) => {
        if (active) setHealth(data);
      })
      .catch(() => {
        if (active) setHealth({ status: 'unreachable', db: 'down' });
      });
    return () => {
      active = false;
    };
  }, []);

  if (!health) {
    return (
      <div className="rounded-lg border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-black/50">
        正在检查数据库连接…
      </div>
    );
  }

  const up = health.db === 'up';
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        up
          ? 'border-emerald-600/25 bg-emerald-50 text-emerald-900'
          : 'border-amber-600/30 bg-amber-50 text-amber-900'
      }`}
    >
      <span className="font-medium">{up ? '数据库已连接' : '数据库未连接'}</span>
      <span className="ml-2 opacity-80">
        {up
          ? '门禁 A 已通过，可以开始接入真实数据。'
          : '门禁 A 尚未完成：本页暂不展示真实数据，也不伪装成空列表。'}
      </span>
    </div>
  );
}
