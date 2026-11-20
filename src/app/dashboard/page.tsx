import Link from 'next/link';
import { DbStatus } from '@/components/db-status';

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
    desc: '按天看调用量、token、成本、失败率、P95 延迟',
    milestone: 'W4',
    href: '/dashboard/usage',
  },
  {
    title: '发布日历',
    desc: '自媒体排期与连载更新节奏',
    milestone: 'W4',
    href: '/dashboard/calendar',
  },
] as const;

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">工作台</h1>
      <p className="mb-6 text-sm text-black/55">
        四个模块按 W2 → W3 → W4 顺序落地。卡片已可点击进入各自的页面。
      </p>
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
