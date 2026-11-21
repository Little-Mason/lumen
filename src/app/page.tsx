import Link from 'next/link';
import { ContentCard } from '@/components/content-card';
import { listPublished } from '@/server/services/content.service';

export const dynamic = 'force-dynamic';

const modules = [
  {
    tag: 'W1',
    name: '内容模型与认证',
    desc: '统一内容表（文章 / 章节 / 笔记）、草稿流转、JWT 会话',
    status: '认证已闭环',
  },
  {
    tag: 'W2',
    name: '写作台与公开站',
    desc: 'Markdown 编辑、标签、发布、SEO / RSS / sitemap',
    status: '已实现',
  },
  {
    tag: 'W3',
    name: 'AI 能力与 RAG',
    desc: '大纲 / 润色 / 摘要 / 标签 / 标题，知识库问答与流式输出',
    status: '契约已定义',
  },
  {
    tag: 'W4',
    name: '数据看板与上线',
    desc: 'AI 成本与用量、发布日历、CI/CD、部署与监控',
    status: '流水线已就位',
  },
];

export default async function HomePage() {
  const latest = await listPublished({ pageSize: 3 }).catch(() => null);

  return (
    <div>
      <section className="mb-12">
        <p className="mb-3 text-sm font-medium text-accent">AI-NATIVE CONTENT HUB</p>
        <h1 className="mb-4 text-4xl font-semibold tracking-tight">一处写作，三处生长</h1>
        <p className="max-w-2xl text-lg leading-8 text-black/65">
          Lumen 把技术博客、小说连载和学习笔记放进同一个内容中枢：前台是自媒体站点，后台是 AI
          辅助写作台， 底层的向量检索让所有内容变成可提问的个人知识库。
        </p>
      </section>

      {latest && latest.items.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">最新发布</h2>
            <Link href="/posts" className="text-sm text-black/50 hover:text-black/80">
              查看全部 →
            </Link>
          </div>
          <div className="grid gap-4">
            {latest.items.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-12 grid gap-4 sm:grid-cols-2">
        {modules.map((m) => (
          <div key={m.tag} className="rounded-xl border border-black/10 bg-white p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-accent">{m.tag}</span>
              <span className="text-xs text-black/40">{m.status}</span>
            </div>
            <h2 className="mb-2 text-base font-semibold">{m.name}</h2>
            <p className="text-sm leading-6 text-black/60">{m.desc}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold">工程基线</h2>
        <p className="text-sm leading-7 text-black/65">
          Next.js 15 App Router + TypeScript + Prisma/PostgreSQL(pgvector) · 每次 AI 调用记录
          token、成本与延迟 · GitHub Actions 执行 lint / typecheck / test / build / E2E / 镜像构建 ·
          多阶段 Docker 镜像与 standalone 输出 · 部署前自动迁移、部署后健康检查。
        </p>
      </section>
    </div>
  );
}
