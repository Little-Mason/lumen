export const metadata = { title: '工作台' };

const cards = [
  { title: '内容', desc: '草稿 / 已发布 / 章节进度，按类型筛选', milestone: 'W2' },
  { title: 'AI 辅助', desc: '大纲、标题、标签、摘要、润色、知识库问答', milestone: 'W3' },
  { title: '用量与成本', desc: '按天看调用量、token、成本、失败率、P95 延迟', milestone: 'W4' },
  { title: '发布日历', desc: '自媒体排期与连载更新节奏', milestone: 'W4' },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">工作台</h1>
      <p className="mb-8 text-sm text-black/55">
        第一版架构占位页。登录守卫与真实数据将在 W2 接入；此处保留信息架构，方便按模块推进。
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.title} className="rounded-xl border border-black/10 bg-white p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">{c.title}</h2>
              <span className="text-xs text-accent">{c.milestone}</span>
            </div>
            <p className="text-sm text-black/60">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
