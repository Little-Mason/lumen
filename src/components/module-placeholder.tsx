import Link from 'next/link';
import { DbStatus } from '@/components/db-status';

type Props = {
  title: string;
  milestone: string;
  summary: string;
  capabilities: string[];
  note?: string;
};

/** 模块占位页共用骨架：标题 + 里程碑 + 计划能力 + 真实数据库状态。 */
export function ModulePlaceholder({ title, milestone, summary, capabilities, note }: Props) {
  return (
    <div>
      <Link href="/dashboard" className="text-sm text-black/50 hover:text-black/80">
        ← 返回工作台
      </Link>
      <div className="mb-2 mt-4 flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <span className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-accent">
          {milestone}
        </span>
      </div>
      <p className="mb-6 text-sm text-black/55">{summary}</p>
      <DbStatus />
      <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold">计划能力</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-black/60">
          {capabilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs text-black/45">
        当前为诚实占位页：尚未接入真实数据，也不伪装成空列表。{note}
      </p>
    </div>
  );
}
