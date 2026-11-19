# Lumen · AI 内容中枢

[![CI](https://github.com/Little-Mason/lumen/actions/workflows/ci.yml/badge.svg)](https://github.com/Little-Mason/lumen/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> 一处写作，三处生长：技术博客、小说连载、学习笔记进同一个系统，前台做自媒体，后台做 AI 写作台，底层把全部内容变成可提问的个人知识库。

**仓库**：[github.com/Little-Mason/lumen](https://github.com/Little-Mason/lumen) · 分支 `main` · 当前为 v0.1 架构骨架

Lumen（`光栈`）是一个 AI 原生的个人内容工作台。它同时服务两个目的：**真实可用的自媒体发布站**，以及**能讲清楚全栈 + AI + CI/CD 的面试作品**。内容来源不是造的假数据——技术文章来自项目本身，小说章节来自每日连载，笔记来自备考与复盘，天然有真实流量和真实数据。

## 能做什么

| 模块 | 内容 | 阶段 |
|---|---|---|
| 统一内容模型 | `ARTICLE / CHAPTER / NOTE` 三类共用一张表，草稿 → 审阅 → 发布 → 归档 | W1 |
| 前台公开站 | 列表、详情、标签、Markdown 渲染、SEO/OG、sitemap、RSS | W2 |
| 后台写作台 | 登录、Markdown 编辑、自动 slug、字数与阅读时长、发布日历 | W2 |
| AI 辅助 | 大纲 / 标题 / 标签 / 摘要 / 润色，流式输出，prompt 防注入 | W3 |
| 知识库问答 | 内容切片 → embedding → pgvector 检索 → 带引用回答（RAG） | W3 |
| 用量看板 | 每次 AI 调用的 token、成本、延迟、失败率、预算告警 | W4 |
| 工程基线 | CI 门禁、E2E、多阶段 Docker 镜像、自动迁移、健康检查、回滚 | W1 → W4 |

## 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 全栈框架 | Next.js 15 App Router + React 19 + TypeScript | RSC 减少客户端 JS，一套代码覆盖前后台与 API |
| 样式 | Tailwind CSS 3 | 快速且无需额外设计系统 |
| ORM / DB | Prisma 6 + PostgreSQL 16 + pgvector | 关系数据与向量检索同库，省掉一套向量数据库 |
| 认证 | jose (JWT) + bcryptjs + httpOnly Cookie | 无第三方依赖，可讲清会话与 CSRF 权衡 |
| AI | Vercel AI SDK v4 + OpenAI 兼容协议 | 换 DeepSeek / OpenAI / 硅基流动只改 `.env` |
| 校验 | Zod | 环境变量与所有入参统一校验 |
| 测试 | Vitest（单元） + Playwright（E2E） | 快 + 真实浏览器 |
| CI/CD | GitHub Actions + GHCR + standalone Docker | 免费、可展示、健康检查与回滚完整 |

## 目录结构

```
lumen/
├── .github/workflows/     ci.yml（门禁） / deploy.yml（发布）
├── prisma/
│   ├── schema.prisma      数据模型（含 aiJob 审计表、vector 切片表）
│   ├── sql/001_pgvector.sql  扩展与 HNSW 索引
│   └── seed.ts            种子数据
├── src/
│   ├── app/               页面与 Route Handlers（含 /api/health）
│   ├── components/        UI 组件
│   ├── lib/               env / db / logger / auth / ai / utils（无业务耦合）
│   ├── server/services/   content.service / ai.service（业务编排）
│   └── types/             共享 DTO 契约
├── tests/                 unit / e2e
├── docs/                  ROADMAP / API / AI-DESIGN / CI-CD / DEPLOYMENT / INTERVIEW / ADR
├── ARCHITECTURE.md        第一版架构（图 + 决策 + 演进）
├── Dockerfile             多阶段构建，standalone 输出
└── docker-compose.yml     本地 Postgres(pgvector) + Redis
```

## 快速开始

```bash
# 1. 起依赖
docker compose up -d

# 2. 装依赖与环境变量
npm install
cp .env.example .env        # 填入 AUTH_SECRET、AI_API_KEY、EMBEDDING_API_KEY

# 3. 建表 + 向量索引 + 种子数据
npx prisma db push
psql "$DATABASE_URL" -f prisma/sql/001_pgvector.sql
npm run db:seed

# 4. 跑起来
npm run dev                 # http://localhost:3000 ，/api/health 返回 200 即通
```

> 第一版是**架构骨架**：目录、契约、数据模型、CI/CD、文档已就位，页面与部分服务为占位实现，W2/W3 会替换。依赖未预装，按上面第 2 步执行即可。
>
> **当前状态**：依赖已锁定（`package-lock.json` + CI 用 `npm ci`）。本地已验证 `typecheck`、`lint` 与单元测试（4/4）全绿；生产构建与 E2E 以 GitHub Actions（`ubuntu-latest`）结果为准——本机 Windows 环境写 `.next/trace` 会报 `EPERM`，不影响 CI。页面与部分服务仍是骨架实现，按 `docs/ROADMAP.md` W1–W3 替换。

## 常用脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` / `build` / `start` | 开发 / 生产构建 / 启动 |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm test` / `test:e2e` | 单元 / 端到端 |
| `npm run db:validate` / `db:migrate` / `db:studio` | 校验 schema / 生成迁移 / 可视化 |
| `npm run docker:up` | 起本地 Postgres + Redis |

## 环境变量

完整清单见 `.env.example`。最小必需：`DATABASE_URL`、`AUTH_SECRET`；启用 AI 再补 `AI_API_KEY`，启用 RAG 再补 `EMBEDDING_API_KEY`。**服务端变量一律不进 `NEXT_PUBLIC_*`**。

## 四周路线与验收

| 周 | 交付 | 验收（DoD） |
|---|---|---|
| W1 11/19–11/25 | 仓库、架构、CI、schema、认证、登录注册 | push 触发 CI 全绿；`/api/health` 返回 200 |
| W2 11/26–12/02 | 内容 CRUD、写作台、公开站、SEO、单测 | 从后台发一篇文章，前台可见且被搜索引擎可索引 |
| W3 12/03–12/09 | 五种 AI 能力、流式、RAG、E2E | 能对已发布内容提问并给出带出处的回答 |
| W4 12/10–12/19 | 看板、上线、2 篇技术文、简历与面试话术 | 在线链接 + 演示视频 + 完整 README |

详见 `docs/ROADMAP.md`。

## 文档索引

`ARCHITECTURE.md` 架构与决策 · `docs/API.md` 接口契约 · `docs/AI-DESIGN.md` AI 与 RAG 设计 · `docs/CI-CD.md` 流水线 · `docs/DEPLOYMENT.md` 部署 · `docs/INTERVIEW.md` 面试讲法 · `docs/adr/` 决策记录

MIT License.
