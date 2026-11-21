# Lumen · AI 内容中枢

[![CI](https://github.com/Little-Mason/lumen/actions/workflows/ci.yml/badge.svg)](https://github.com/Little-Mason/lumen/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> 一处写作，三处生长：技术博客、小说连载、学习笔记进同一个系统，前台做自媒体，后台做 AI 写作台，底层把全部内容变成可提问的个人知识库。

**仓库**：[github.com/Little-Mason/lumen](https://github.com/Little-Mason/lumen) · 分支 `main` · 当前为 v0.4（W1 地基 + W2 内容闭环 + W3 AI/RAG + W4 用量看板与发布日历已实现）

Lumen（`光栈`）是一个 AI 原生的个人内容工作台。它同时服务两个目的：**真实可用的自媒体发布站**，以及**能讲清楚全栈 + AI + CI/CD 的面试作品**。内容来源不是造的假数据——技术文章来自项目本身，小说章节来自每日连载，笔记来自备考与复盘，天然有真实流量和真实数据。

## 能做什么

| 模块         | 内容                                                                 | 状态       |
| ------------ | -------------------------------------------------------------------- | ---------- |
| 统一内容模型 | `ARTICLE / CHAPTER / NOTE` 三类共用一张表，草稿 → 审阅 → 发布 → 归档 | ✅ W1      |
| 前台公开站   | 列表、详情、标签、Markdown 渲染、SEO/OG、sitemap、RSS                | ✅ W2      |
| 后台写作台   | 登录、Markdown 编辑、自动 slug、字数与阅读时长                       | ✅ W2      |
| AI 辅助      | 大纲 / 标题 / 标签 / 摘要 / 润色，SSE 流式输出，prompt 防注入        | ✅ W3      |
| 知识库问答   | 内容切片 → embedding → HNSW 检索 → 带引用回答（RAG）                 | ✅ W3      |
| 调用记账     | 每次 AI 调用的 token、成本、延迟、失败原因与月度预算熔断             | ✅ W3      |
| 用量看板     | 按天聚合的调用量、成本、失败率、P95 延迟与月度预算                   | ✅ W4      |
| 发布日历     | 月视图发布节奏、连更统计、断更提醒，只读真实 `publishedAt`           | ✅ W4      |
| 工程基线     | CI 门禁、E2E、多阶段 Docker 镜像、自动迁移、容器健康检查、回滚       | ✅ W1 → W4 |

## 技术栈

| 层       | 选型                                          | 理由                                        |
| -------- | --------------------------------------------- | ------------------------------------------- |
| 全栈框架 | Next.js 15 App Router + React 19 + TypeScript | RSC 减少客户端 JS，一套代码覆盖前后台与 API |
| 样式     | Tailwind CSS 3                                | 快速且无需额外设计系统                      |
| ORM / DB | Prisma 6 + PostgreSQL 16 + pgvector           | 关系数据与向量检索同库，省掉一套向量数据库  |
| 认证     | jose (JWT) + bcryptjs + httpOnly Cookie       | 无第三方依赖，可讲清会话与 CSRF 权衡        |
| AI       | Vercel AI SDK v4 + OpenAI 兼容协议            | 换 DeepSeek / OpenAI / 硅基流动只改 `.env`  |
| 校验     | Zod                                           | 环境变量与所有入参统一校验                  |
| 测试     | Vitest（单元） + Playwright（E2E）            | 快 + 真实浏览器                             |
| CI/CD    | GitHub Actions + GHCR + standalone Docker     | 免费、可展示、健康检查与回滚完整            |

## 目录结构

```
lumen/
├── .github/workflows/     ci.yml（门禁） / deploy.yml（发布）
├── prisma/
│   ├── schema.prisma      数据模型（含 aiJob 审计表、vector 切片表）
│   ├── migrations/        首份迁移 20261121000000_init
│   ├── sql/               000_extensions.sql（扩展）/ 001_pgvector.sql（HNSW 索引）
│   └── seed.ts            种子数据
├── src/
│   ├── app/               页面与 Route Handlers（含 /api/health）
│   ├── components/        UI 组件
│   ├── lib/               env / db / logger / auth / ai / utils（无业务耦合）
│   │   └── ai/            provider / prompts / mock / chunk / cache / quota / rate-limit / sse-client
│   ├── server/services/   content / ai / rag / index-sync（业务编排）
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
cp .env.example .env        # 只需填 AUTH_SECRET；AI 默认走 mock provider，密钥可选

# 3. 扩展 → 迁移 → 向量索引 → 种子数据（顺序不能反）
npx prisma db execute --file prisma/sql/000_extensions.sql --schema prisma/schema.prisma
npx prisma migrate deploy
npx prisma db execute --file prisma/sql/001_pgvector.sql --schema prisma/schema.prisma
npm run db:seed

# 4. 跑起来
npm run dev                 # http://localhost:3000 ，/api/health 返回 200 即通
```

> **本机 Docker 起不来时**：可以完全绕开 Docker，用 Windows 原生 PostgreSQL 16 + pgvector 预编译包，同样满足 `DATABASE_URL`。这是当前开发机的实际配置（`D:\appRun\PostgreSQL\16`，服务 `postgresql-x64-16`），步骤与验收结果见 `docs/DASHBOARD-PLAN.md` 的「门禁 A · A4」。`docker-compose.yml` 仍保留给 CI/CD 与容器化部署使用，两条路径的数据库凭据一致。
>
> 2026-11-21 补充：Docker 引擎已通过 `docker-vmm` 模式修复（不依赖 WSL2），Docker Hub 直连超时已用 `registry-mirrors`（`docker.m.daocloud.io`）解决，容器创建/启动/`exec` 均验证通过。本机 5432 仍被原生 PostgreSQL 占用，compose 的 db 已改映射宿主 `5433`；开发只起 Redis 用 `docker compose up -d redis`，整栈容器化用 `docker compose --profile app up -d --build`（app 映射到 `3100`，内含 `HEALTHCHECK`）。详见 `docs/DEPLOYMENT.md`。

> 2026-11-21 补充：`CREATE EXTENSION vector` 需要管理员权限，托管 Postgres 请先在平台 SQL 编辑器执行一次；扩展已存在时 `000_extensions.sql` 只是安全的 no-op。CI 的 `pgvector/pgvector:pg16` 里 `POSTGRES_USER=lumen` 本身就是超级用户，可以直接执行。

> **当前状态**：依赖已锁定（`package-lock.json` + CI 用 `npm ci`）。W1 地基、门禁 B 认证闭环、W2 内容闭环、W3 AI/RAG、W4 用量看板与发布日历均已落地；本地 `lint`、`typecheck`、`db:validate`、单元测试（102/102）全绿，生产构建与 E2E 以 GitHub Actions（`ubuntu-latest`）结果为准——本机 Windows 环境写 `.next/trace` 会报 `EPERM`，不影响 CI。**剩下的不是代码功能，而是上线与包装**：生产 secrets / 域名、2 篇技术文章、演示视频与截图、`docs/INTERVIEW.md` 里的线上真实指标。

## 门禁 B · 认证闭环（已通过）

`/dashboard/*` 现已受保护，`/login` 提供登录与注册（带邀请码）。种子账号由 `npm run db:seed` 创建：

```text
邮箱 owner@lumen.local    密码 change-me-123    角色 OWNER
```

命令行验收（把 Cookie 存到文件，模拟真实浏览器）：

```bash
# 未登录访问工作台 → 307 跳登录页
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/dashboard

# 登录 → 200 且写 httpOnly Cookie
curl -s -c /tmp/lumen.cookies -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@lumen.local","password":"change-me-123"}'

# 带会话读 me / 访问工作台
curl -s -b /tmp/lumen.cookies http://localhost:3000/api/auth/me
curl -s -o /dev/null -w '%{http_code}\n' -b /tmp/lumen.cookies http://localhost:3000/dashboard

# 退出 → 再访问工作台重新被拦截
curl -s -b /tmp/lumen.cookies -c /tmp/lumen.cookies -X POST http://localhost:3000/api/auth/logout
```

`AUTH_INVITE_CODE` 为空时只允许一个账号；本机 `.env` 与 CI 均设为 `lumen-dev-invite`（见 `.github/workflows/ci.yml`）。E2E 覆盖「未登录拦截 → 种子账号登录 → 邀请码注册 → 退出后再次被拦截」。

## W2 · 内容闭环（已通过）

登录后进 `/dashboard/content`：列表支持状态、类型、标签与关键词筛选；`/dashboard/content/new` 是带实时预览的 Markdown 写作台，可保存草稿、发布、下线、归档。

| 页面 / 接口                                    | 说明                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `/posts`、`/posts/[slug]`、`/tags/[slug]`      | 公开列表、详情、标签页；详情带 title / description / OG / canonical |
| `/sitemap.xml`、`/rss.xml`、`/robots.txt`      | 由 Route Handler 与静态文件生成，读真实已发布内容                   |
| `GET /api/contents`、`GET /api/tags`           | 公开只读，仅返回 `PUBLISHED`                                        |
| `POST /api/contents`                           | 登录用户建草稿：自动 slug、摘要、字数、阅读时长、标签               |
| `GET/PATCH/DELETE /api/contents/:id`           | 作者本人读写全文；DELETE 为软归档，不物理删除                       |
| `POST /api/contents/:id/publish`、`/unpublish` | 发布写 `publishedAt`；下线回草稿                                    |

中文标题会生成含中文的 slug，动态路由参数用 `normalizeSlugParam()` 解码后再查库。状态流转走 `canTransition()` 白名单，归档内容必须先回到草稿。首份迁移在 `prisma/migrations/20261121000000_init`，CI/CD 已从 `db push` 切到 `migrate deploy`。

## W3 · AI 与 RAG（已通过）

`/dashboard/ai` 是三个页签：**写作助手**（五种能力、流式/非流式切换、载入已有正文）、**知识库问答**（流式回答 + 可点击引用）、**调用记录**（token、成本、延迟、状态）。写作台的编辑器里也内嵌了 AI 工具条，生成结果确认后可一键回填标题、标签、摘要或正文。

```bash
# 非流式生成摘要
curl -s -b /tmp/lumen.cookies -X POST http://localhost:3000/api/ai/run \
  -H 'Content-Type: application/json' \
  -d '{"kind":"SUMMARIZE","body":"# 标题\n\n正文内容","stream":false}'

# 流式润色（SSE）
curl -N -b /tmp/lumen.cookies -X POST http://localhost:3000/api/ai/run \
  -H 'Content-Type: application/json' \
  -d '{"kind":"POLISH","body":"待润色正文","stream":true}'

# 知识库问答
curl -s -b /tmp/lumen.cookies -X POST http://localhost:3000/api/ai/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"pgvector 的 HNSW 索引怎么用？","stream":false}'

# 手动重建某篇内容的切片
curl -s -b /tmp/lumen.cookies -X POST http://localhost:3000/api/contents/<id>/reindex
```

实现要点：

- **Provider 可插拔**：`AI_PROVIDER=mock`（默认）用确定性哈希词袋 embedding 与模板化输出，无密钥、零 token、CI 可稳定断言；改成 `openai-compatible` 并填好两组密钥即接 DeepSeek / OpenAI / 硅基流动，业务代码不动。
- **发布即索引**：publish / 已发布内容的正文更新自动重建切片，unpublish / archive 删除切片；索引失败只记日志，绝不阻断发布，可调用 `/reindex` 补偿。
- **检索**：按 Markdown 标题与段落边界切 500–800 字（重叠 80 字），`embedding <=> $1::vector` 走 HNSW 余弦检索，只返回已发布内容；片段不足时明确回答「内容库中没有相关记录」。
- **防注入**：统一的 `SYSTEM_PROMPT` 声明正文与检索片段里的指令一律当数据；任务指令放在输入之后；单测覆盖夹带指令的正文，断言注入词不进入输出。
- **可运维**：每次调用（含失败）都落 `AiJob`；每分钟限流支持 Redis `INCR+EXPIRE` 与进程内降级；月度预算按 `costCents` 汇总熔断；非流式结果按 `kind + contentId + 正文 hash` 缓存 24h。详见 `docs/AI-DESIGN.md`。

## W4 · 用量看板与发布日历（已实现）

| 入口                     | 数据来源                    | 关键指标                                                        |
| ------------------------ | --------------------------- | --------------------------------------------------------------- |
| `/dashboard/usage`       | `AiJob`（当前用户）         | 调用量、失败率、token、成本、P50/P95、按能力/模型分组、月度预算  |
| `/dashboard/calendar`    | `Content.publishedAt`       | 月视图、发布天数、最长连更、章节数、累计字数、断更提醒            |
| `GET /api/ai/usage`      | 同上，`days=1..90`          | 供看板、告警或外部脚本消费                                      |
| `GET /api/calendar`      | 同上，`month=YYYY-MM`       | 返回月网格与条目，UTC 自然日切分                                |

聚合逻辑刻意放在纯函数层（`src/lib/usage/metrics.ts`、`src/lib/calendar/grid.ts`），不依赖 Prisma 或环境变量，因此能直接单测 P95、补零日序列、跨年翻页与连更计算。日历**不实现**定时发布与拖拽排期：它只展示真实已发生的节奏，不伪造未来计划。mock provider 下成本是估算值，页面会明确标注，避免把演示数据当成真实账单。

容器健康检查随本阶段收尾：`Dockerfile` 的 `HEALTHCHECK` 调 `scripts/healthcheck.mjs`，只在 `/api/health` 返回 200 时通过；compose 的 `app` service 用 `docker compose --profile app up -d --build` 启动，命令见 `docs/DEPLOYMENT.md`。

## 常用脚本

| 命令                                                             | 作用                                |
| ---------------------------------------------------------------- | ----------------------------------- |
| `npm run dev` / `build` / `start`                                | 开发 / 生产构建 / 启动              |
| `npm run lint` / `typecheck`                                     | ESLint / `tsc --noEmit`             |
| `npm test` / `test:e2e`                                          | 单元 / 端到端                       |
| `npm run db:validate` / `db:migrate` / `db:deploy` / `db:studio` | 校验 / 生成迁移 / 应用迁移 / 可视化 |
| `npm run docker:up`                                              | 起本地 Postgres + Redis             |

## 环境变量

完整清单见 `.env.example`。最小必需只有 `DATABASE_URL`、`AUTH_SECRET`——AI 默认 `AI_PROVIDER=mock`，不填密钥也能跑完整闭环。要接真实模型再补 `AI_API_KEY` / `EMBEDDING_API_KEY` 并切换 `AI_PROVIDER`；`REDIS_URL` 只在多实例部署时需要。**服务端变量一律不进 `NEXT_PUBLIC_*`**。

## 四周路线与验收

| 周             | 交付                                   | 验收（DoD）                                  |
| -------------- | -------------------------------------- | -------------------------------------------- |
| W1 11/19–11/25 | 仓库、架构、CI、schema、认证、登录注册 | push 触发 CI 全绿；`/api/health` 返回 200    |
| W2 11/26–12/02 | 内容 CRUD、写作台、公开站、SEO、单测   | 从后台发一篇文章，前台可见且被搜索引擎可索引 |
| W3 12/03–12/09 | 五种 AI 能力、流式、RAG、E2E           | 能对已发布内容提问并给出带出处的回答         |
| W4 12/10–12/19 | 看板、上线、2 篇技术文、简历与面试话术 | 在线链接 + 演示视频 + 完整 README            |

详见 `docs/ROADMAP.md`。

## 文档索引

`ARCHITECTURE.md` 架构与决策 · `docs/API.md` 接口契约 · `docs/AI-DESIGN.md` AI 与 RAG 设计 · `docs/CI-CD.md` 流水线 · `docs/DEPLOYMENT.md` 部署 · `docs/INTERVIEW.md` 面试讲法 · `docs/adr/` 决策记录

MIT License.
