import Link from 'next/link';
import { DbStatus } from '@/components/db-status';
import { readSession } from '@/lib/auth/session';

export const metadata = { title: '工作台' };

const cards = [
  {
    title: '内容',
    desc: '草稿 / 已发布 / 章节进度，按类型筛选',
    milestone: 'W2',
    href: '/dashboard/content',
  },
  {
    title: 'AI 辅助',
    desc: '大纲、标题、标签、摘要、润色、知识库问答',
    milestone: 'W3',
    href: '/dashboard/ai',
  },
  {
    title: '用量与成本',
    desc: '按天看调用量、token、成本、失败率、P95 延迟与月度预算',
    milestone: '已实现',
    href: '/dashboard/usage',
  },
  {
    title: '发布日历',
    desc: '月视图发布节奏、连更统计与断更提醒',
    milestone: '已实现',
    href: '/dashboard/calendar',
  },
] as const;

export default async function DashboardPage() {
  // middleware 是第一道闸；这里再读一次会话，把「谁在登录」显示在页面上。
  const session = await readSession();
  return (
    <div>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">工作台</h1>
      <p className="mb-2 text-sm text-black/55">
        四个模块已全部接入真实数据：内容、AI 辅助、用量与成本、发布日历。
      </p>
      {session && (
        <p className="mb-4 text-xs text-black/45">
          当前登录：{session.email} · 角色 {session.role}
        </p>
      )}
      <DbStatus />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-xl border border-black/10 bg-white p-5 transition-colors hover:border-black/30"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">{c.title}</h2>
              <span className="text-xs text-accent">{c.milestone}</span>
            </div>
            <p className="text-sm leading-6 text-black/60">{c.desc}</p>
            <span className="mt-3 inline-block text-xs text-black/40 group-hover:text-black/70">
              进入模块 →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
