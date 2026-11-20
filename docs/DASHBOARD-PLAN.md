# 工作台四模块落地与部署执行清单

> 2026-11-20 基于当天实际代码与运行态逐项核对，不是通用模板。  
> 项目路径 `D:\workspace\lumen`，dev server 已启动在 `http://localhost:3000`。  
> **17:50 更新**：Step 1 已完成并验收（见第 3 节）；下方第 0 节表格为修复前的历史实测，四个子路由现已 200。  
> **19:20 更新**：门禁 A 已通过，`/api/health` 返回 200 `{"status":"ok","db":"up"}`。本机 Docker Desktop 因 Windows CBS 挂起事务（Hyper-V 负载未落地 System32、`WslVirtualMachinePlatformNotEnabled`）无法启动引擎，改用 **A4 Windows 原生 PostgreSQL 16.16 + pgvector 0.8.7**，不依赖 Docker / WSL。四个模块现在可以开始接真实数据。
> **20:45 更新**：Docker 本体已修好但不再作为开发数据库。把 `settings-store.json` 的 `EngineTypeWindows` 从 `wsl2` 改成 `docker-vmm`（备份 `settings-store.json.bak-wsl2`）后，由用户自己双击桌面快捷方式启动（避开 `wsl.exe` 程序黑名单），引擎正常起来：`docker version` Server = Docker Desktop 4.99.0 / Engine 29.9.3 / linux/amd64，context `desktop-linux`，`docker compose config` 能解析出 `db` + `redis`。**遗留限制**：本机到 `registry-1.docker.io:443` 直连和代理都超时，`docker run hello-world` 拉不到镜像，`docker compose up -d` 暂时不可用；CI/CD 在 GitHub Actions 上构建镜像，不受影响。开发继续用 A4 原生 PostgreSQL，不改 `.env`。如需本机跑容器，要先给 Docker Desktop 配可用的 HTTPS 代理或可用的 registry mirror，再重启引擎。

## 0. 当前运行态（今日实测）

| 路由                                               | 实测 | 说明                                                      |
| -------------------------------------------------- | ---- | --------------------------------------------------------- |
| `/`                                                | 200  | 首页，静态模块卡片                                        |
| `/dashboard`                                       | 200  | 四张卡片占位页                                            |
| `/dashboard/content`、`/ai`、`/usage`、`/calendar` | 404  | 路由文件不存在                                            |
| `/posts/building-lumen`                            | 500  | 该页直接查库，DB 未起                                     |
| `/api/health`                                      | 503  | `{"status":"degraded","db":"down"}`，设计内降级，不是崩溃 |

启动与自愈：

```bash
cd /d/workspace/lumen
npm run dev
```

若启动即退出并报 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`（Next 清理旧 `.next` 触发本机批量删除保护），不要去调安全设置，用单次改名把旧缓存移走再启动：

```bash
mv .next /d/workspace/_lumen-stale/next-dev-$(date +%H%M%S)
npm run dev
```

状态巡检（每步改完都跑一遍）：

```bash
for p in / /dashboard /dashboard/content /dashboard/ai /dashboard/usage /dashboard/calendar /api/health; do
  printf '%s -> ' "$p"; curl -s -o /dev/null -w 'HTTP %{http_code}\n' "http://127.0.0.1:3000$p"
done
```

## 1. 四个模块点不进去：根因

1. **没有导航元素**：`src/app/dashboard/page.tsx` 里 `cards` 渲染的是纯 `<div>`，没有 `<Link>` / `href` / `onClick`。实测 `/dashboard` 输出的 href 只有 `/`、`/dashboard`、`/posts/building-lumen` 和静态资源，四张卡片根本不是链接。
2. **没有目标路由**：`src/app/dashboard/` 下只有 `page.tsx`，没有任何子目录，所以四个候选路径全部 404。即便补了链接也仍然点不进去。
3. **数据层未就绪**：`DATABASE_URL` 指向本机 5432，实测端口未监听、Docker 未安装、`psql` 不在 PATH。四模块最终都要读 `Content` / `AiJob`，DB 不通就只能做静态页面。

结论：这不是数据损坏，是 v0.1 骨架的预期状态；但「看得见卡片却点不动」是真交互缺陷，Step 1 先修掉。

## 2. 两个前置门禁

### 门禁 A · 数据库（做模块功能前必须过）

三选一，选完把 `/api/health` 打到 200 才算过：

- **A1 装 Docker Desktop**（本机没有，需 WSL2 / 管理员 / 可能重启）：

  ```bash
  docker compose up -d
  npx prisma db push
  npx prisma db execute --file prisma/sql/001_pgvector.sql --schema prisma/schema.prisma
  npm run db:seed
  curl -s http://127.0.0.1:3000/api/health
  ```

- **A2 托管 Postgres（Neon / Supabase，需支持 `vector` 扩展）**：把连接串写进 `.env` 的 `DATABASE_URL`，然后跑 `npx prisma db push` + `npm run db:seed`。本机没有 `psql`，`001_pgvector.sql` 改用平台网页 SQL 编辑器执行，或：
  ```bash
  npx prisma db execute --file prisma/sql/001_pgvector.sql --schema prisma/schema.prisma
  ```
- **A3 暂不接库**：只做 Step 1（导航），其余步骤等 DB 就绪。页面必须显式提示「数据库未连接」，不要伪装成空列表。
- **A4 Windows 原生 PostgreSQL（2026-11-20 实际采用）**：适用于 Docker Desktop 因 WSL2 / Hyper-V servicing 卡住时。EDB 官方 `postgresql-16.16-2-windows-x64.exe`（SHA256 `dd526f2d…5e8e128`）静默装到 `D:\appRun\PostgreSQL\16`，服务 `postgresql-x64-16` 自动启动；pgvector 用 `andreiramani/pgvector_pgsql_windows` 的 `vector.v0.8.7-pg16.zip` 预编译包，把 `lib/vector.dll`、`share/extension/vector.control` 和 `vector--*.sql` 复制到安装目录（该目录 ACL 只允许管理员写，需提权复制）。随后用 `psql` 建 `lumen` 角色 / 库 / `vector` 扩展，再跑 `npx prisma db push` → `prisma/sql/001_pgvector.sql` → `npm run db:seed`。凭据与 `.env` 的 `DATABASE_URL=postgresql://lumen:lumen@localhost:5432/lumen` 完全一致，`redis` 服务目前无代码依赖，可暂不启动。

  **验收记录**：`PostgreSQL 16.16` / `vector 0.8.7`；7 张表 + `content_chunk_embedding_hnsw` 索引；种子 1 user / 2 contents；`/api/health` 200、`/posts/building-lumen` 200、`/dashboard` 及四个子路由全 200。

### 门禁 B · W1 认证闭环

|                                                                                                                                                                    |       |                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------ |
| 现在 `/dashboard` 是公开的，任何人都能进工作台。按 `docs/API.md` 实现 \`POST /api/auth/register                                                                    | login | logout`、`GET /api/auth/me`，加 `src/middleware.ts`保护`/dashboard/*\`。 |
| **DoD**：未登录访问 `/dashboard/content` 跳转 `/login`；用种子账号 `owner@lumen.local / change-me-123`（`docs/DEPLOYMENT.md`）登录后可见；`AUTH_SECRET` 非占位值。 |       |                                                                          |

## 3. Step 1 · 恢复可点击（不依赖 DB）

> **状态：2026-11-20 17:50 已完成并验收。** 四张卡片改为 `next/link` 的 `<Link>`；新建四个路由文件与共用的 `ModulePlaceholder`；新增 `DbStatus` 客户端组件，运行时探测 `/api/health` 并显式提示「数据库未连接」，不伪装成空列表。验收：`/dashboard` 输出 4 条 `href="/dashboard/..."`；四个路径全 200；`npm run lint`、`npm run typecheck`、`npm test`(4/4) 全绿。顺带把 Next 自动生成的 `next-env.d.ts` 加入 ESLint `ignorePatterns`（它含 triple-slash reference，不应手改）。当时 `/api/health` 为 503 degraded，符合门禁 A 未完成时的预期；19:20 门禁 A 通过后已变为 200。

改 `src/app/dashboard/page.tsx`：卡片加 `href`，外层 `<div>` 换成 `next/link` 的 `<Link>`。

```tsx
import Link from 'next/link';

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
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">工作台</h1>
      <p className="mb-8 text-sm text-black/55">四个模块按 W2 → W3 → W4 顺序落地。</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-black/10 bg-white p-5 transition-colors hover:border-black/30"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">{c.title}</h2>
              <span className="text-xs text-accent">{c.milestone}</span>
            </div>
            <p className="text-sm leading-6 text-black/60">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

再建四个路由文件：`src/app/dashboard/{content,ai,usage,calendar}/page.tsx`。后三个此阶段只做诚实占位页（标题 + 里程碑 + 计划能力 + 返回工作台链接），不要假装有功能：

```tsx
import Link from 'next/link';
export const metadata = { title: 'AI 辅助' };
export default function Page() {
  return (
    <div>
      <Link href="/dashboard" className="text-sm text-black/50">
        ← 返回工作台
      </Link>
      <h1 className="mb-2 mt-4 text-3xl font-semibold tracking-tight">AI 辅助</h1>
      <p className="text-sm text-black/55">W3 实现：五种能力、流式输出、RAG 问答。当前为占位页。</p>
    </div>
  );
}
```

> 坑：内部跳转必须用 `next/link`。写 `<a href>` 会被 `@next/next/no-html-link-for-pages` 拦（11-20 已在 `layout.tsx` 踩过一次）。

|                                                      |                                   |                                                                               |
| ---------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| **DoD**：\`curl -s <http://127.0.0.1:3000/dashboard> | grep -o 'href="/dashboard/[^"]*"' | sort -u` 输出 4 条；四个路径全 200；`npm run lint && npm run typecheck\` 绿。 |

## 4. 模块完成顺序（由数据依赖决定）

**内容 → AI 辅助 → 用量与成本 → 发布日历**。  
`Content` 表是单一数据源：`AiJob.contentId` 与 `ContentChunk.contentId` 都指向它；用量看板读 AI 模块产生的 `AiJob` 行，没数据就是空壳；发布日历只读 `publishedAt`，最独立、风险最低，放最后。

### Step 2 · 内容（第一个做完整，W2 主干）

- 契约已定，不要改接口形状：`GET/POST /api/contents`、`GET/PATCH/DELETE /api/contents/:id`、`POST /api/contents/:id/publish`、`GET /api/tags`（`docs/API.md`）。
- 复用 `src/server/services/content.service.ts` 已有的 `createDraft / publish / listPublished`；补 `listAll`（后台要看到 DRAFT/REVIEW/ARCHIVED）、`update`、`archive`。UI 层不许直接碰 Prisma。
- 新建：`src/app/dashboard/content/page.tsx`（列表 + 类型/状态筛选）、`content/new/page.tsx`（编辑器，隔离成客户端组件，走 Server Action 提交）、`src/app/api/contents/route.ts` 与 `[id]/route.ts`。
- 第一版列表页在 DB 未就绪时不能 500，用 try/catch 降级：
  ```tsx
  let items: ContentDTO[] = [];
  let dbUp = true;
  try {
    ({ items } = await listPublished({ pageSize: 20 }));
  } catch {
    dbUp = false;
  }
  // dbUp === false 时渲染「数据库未连接，先做门禁 A」提示条
  ```
- **同时生成并提交第一份迁移**：`npm run db:migrate` → 提交 `prisma/migrations/` → 把 `ci.yml` 的 e2e 与 `deploy.yml` 的 `prisma db push` 改成 `npx prisma migrate deploy`（`docs/ROADMAP.md` W2 明确要求）。
- 顺带补 W2 公开站：`/tags/[slug]`、`sitemap.xml`、`robots.txt`、`rss.xml`、OG meta。

**DoD**：种子文章出现在列表且可按 `ARTICLE/CHAPTER/NOTE` 筛选；建草稿 → 发布 → 匿名窗口 `/posts/<slug>` 返回 200 且 view source 有正确 meta description；`/api/health` 200 `db: up`；`npm test` 与 E2E「登录 → 写 → 发布 → 前台可见」全绿。

### Step 3 · AI 辅助（W3）

- 接口：`POST /api/ai/jobs`、`GET /api/ai/jobs/:id/stream`（SSE）、`POST /api/ai/ask`、`POST /api/contents/:id/reindex`。
- 复用 `src/lib/ai/client.ts`（chat / embedding 双 provider）、`prompts.ts`、`src/server/services/ai.service.ts`；五种 `AiJobKind` 全部落 `AiJob` 记账（token / cost / latency / status）。
- RAG：`ContentChunk` 切片 → embedding → `prisma/sql/001_pgvector.sql` 的 HNSW 索引 → 带 `contentId/chunkIndex` 出处的回答；prompt 防注入用例测试；Redis 限流与 `AI_MONTHLY_BUDGET_CENTS` 预算熔断。
- E2E 必须用 mock provider，别在 CI 烧真实 token。

**DoD**：对已发布内容提问，回答只引用库内片段；`AiJob` 表能看到一次完整记录；`npm run test:e2e` 不依赖外部 API。

### Step 4 · 用量与成本（W4）

- 页面 `src/app/dashboard/usage/page.tsx` + `GET /api/ai/usage` / `GET /api/analytics/overview`；按天聚合 `AiJob`：调用量、token、成本、失败率、P95 延迟。
- 预算告警：日成本超 `AI_MONTHLY_BUDGET_CENTS` 的 20% 触发提示。

**DoD**：Step 3 造出的调用能在看板上看到；失败任务计入失败率；429 预算拦截生效。

### Step 5 · 发布日历（W4）

- `src/app/dashboard/calendar/page.tsx`，按 `Content.publishedAt` 月视图分组，草稿可排期；与打卡表的「每周 1 篇技术文」对齐。

**DoD**：月视图显示已发布与排期条目，改排期后公开站发布时间一致。

## 5. 什么时候适合部署

| 时点                                      | 结论                         | 理由                                                        |
| ----------------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| 现在（v0.1）                              | **不要部署**                 | `/api/health` 503、无认证、四个占位页会公开、无生产 secrets |
| W2 末（约 12/02，Step 2 + 门禁 A/B 完成） | 可部署 **staging / preview** | 目的是打通 CI → CD 链路，不是对外发布                       |
| W4（12/10–12/19，Step 3–5 完成）          | **生产上线**                 | 2 篇技术文、README 截图、回滚演练、健康检查 200 全部就绪    |

上线前检查单（来自 `docs/DEPLOYMENT.md`）：`/api/health` 200 且 `db: up`；生产 `AUTH_SECRET` 非占位、Cookie `Secure`；DB 自动备份与恢复演练；AI 限流与预算；sitemap/robots/OG 用正式域名；Sentry 能收到测试错误；CI → CD 自动跑通且健康检查失败能回滚。

## 6. 部署执行步骤（按顺序）

1. **先修流水线**（见第 7 节），否则下面的步骤不会真正生效。
2. **建生产库**：Neon / Supabase Postgres，确认可执行 `CREATE EXTENSION vector`；记录连接串，必要时加 `?pgbouncer=true`。
3. **执行向量 DDL**：平台 SQL 编辑器跑 `prisma/sql/001_pgvector.sql`，或用 `npx prisma db execute --file prisma/sql/001_pgvector.sql --schema prisma/schema.prisma`（不依赖本机 `psql`）。
4. **生成密钥**：`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`。
5. **GitHub → Settings → Secrets and variables → Actions**：
   - Secrets：`DATABASE_URL`、`AUTH_SECRET`、`AI_API_KEY`、`EMBEDDING_API_KEY`、`VERCEL_TOKEN` 或 `RAILWAY_TOKEN`（`GITHUB_TOKEN` 自动提供）。
   - Variables：`APP_URL` = `https://<正式域名>`；若加了开关再加 `DEPLOY_ENABLED=true`。
   - `environment: production` 建议开 required reviewers，避免误发。
6. **触发**：Actions → Deploy → Run workflow（`workflow_dispatch`），或 push 到 `main` 等 CI 全绿自动触发。
7. **盯流水线**：`quality → build → e2e → image` 全绿后，deploy 推 `ghcr.io/Little-Mason/lumen:sha-<sha>` 与 `:latest` → `prisma migrate deploy` → pgvector DDL → 平台发布 → 轮询 `/api/health` 20 次 × 10s。
8. **验收**：
   ```bash
   curl -s https://<正式域名>/api/health     # 期望 {"status":"ok","db":"up",...}
   ```
   再验：登录 → 发一篇文章 → 前台可见 → sitemap/OG 绝对地址是正式域名 → Sentry 收到一条测试错误。
9. **回滚**：平台切回上一个 `ghcr.io/Little-Mason/lumen:sha-<上一个 sha>`；迁移只做加法，回滚应用不破坏数据结构。W4 必须手动制造一次健康检查失败，验证告警与回滚真的可用。

## 7. 部署前必须修的 4 个真实问题（逐行核对 `deploy.yml` / `Dockerfile`）

1. **平台部署步骤是注释**：`deploy.yml` 第 61–63 行的 Vercel / Railway 命令被注释掉了。当前 CD 只做「推镜像 + 迁移 + 健康检查」，而健康检查打到的仍是旧版本 → 必须取消注释并填 token，否则「部署成功」是假的。
2. **`NEXT_PUBLIC_SITE_URL` 是构建期注入**：`Dockerfile` 第 18 行默认 `http://localhost:3000`，`deploy.yml` 的 `docker/build-push-action` 没传 `build-args`。生产镜像会把 localhost 烤进 OG / sitemap / RSS。要给该 step 加：
   ```yaml
   build-args: |
     NEXT_PUBLIC_SITE_URL=${{ vars.APP_URL }}
   ```
3. **迁移方式仍是 W1 做法**：`deploy.yml` 第 58 行与 `ci.yml` 第 72 行都是 `prisma db push`。W2 生成首份迁移后统一改成 `npx prisma migrate deploy`，否则生产库会漂移。
4. **deploy.yml 会自动触发**：`workflow_run` 只要 main 的 CI 成功就跑。secrets 没配时必然红灯。建议给 `jobs.deploy.if` 加 `vars.DEPLOY_ENABLED == 'true' &&`，W4 准备上线时再打开。

## 8. 注意事项

- 本机 Windows 上 `npm run build` 稳定报 `EPERM .next/trace`，**不要在本机构建或部署**；以 `ubuntu-latest` 的 Actions 结果为准。
- `.env` 已被 `.gitignore` 覆盖，永不提交；密钥只放 GitHub Secrets，绝不进 `NEXT_PUBLIC_*`、绝不打进日志或镜像层。
- `EMBEDDING_DIM=1536` 必须与 `schema.prisma` 的 `vector(1536)` 一致；换 embedding 模型要同步改列、索引、清空 `ContentChunk` 并全量重切。
- Serverless 部署要连接池参数；`src/lib/db.ts` 已处理 HMR 复用 `PrismaClient`。
- `docs/CI-CD.md` 里写的是 `npm install`，实际 `ci.yml` 已切 `npm ci`——以 workflow 文件为准。
- 每日备份 Postgres；监控 `/api/health`、AiJob 日成本、错误率三项。

## 9. 命令速查

```bash
cd /d/workspace/lumen
npm run dev                                   # 启动
npm run lint && npm run typecheck && npm test  # 每次改完
npm run db:validate                            # schema 校验
npm run db:migrate                             # W2 生成首份迁移
npm run db:seed                                # 种子数据
npm run test:e2e                               # 需 DB 起好
git add -A && git commit -m "..." && git push  # 触发 CI
```

## 10. 门禁 B · 认证闭环（2026-11-21 完成）

Docker 侧的前置问题也一并结束：用户启用 `HypervisorPlatform`、重启、把 VMM 内存设为 `MemoryMiB=5104` 后，CBS 的 `pending.xml` 消失、`vmcompute.exe` / `WinHvPlatform.dll` / `vmswitch.sys` 落地。实测 `docker pull hello-world:latest`（经 daocloud registry-mirror）、`docker run --rm hello-world`、后台 `alpine sleep 20` + `docker exec` 全部通过。本机 5432 仍由原生 PostgreSQL 占用，**不要 `docker compose up -d`**。

门禁 B 的实现边界：

| 层                  | 文件                                                                       | 职责                                                            |
| ------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 纯 JWT（Edge 安全） | `src/lib/auth/token.ts`                                                    | 签名 / 验签，显式传 secret，不引 `next/headers`、Prisma、bcrypt |
| 入参校验            | `src/lib/auth/validation.ts`                                               | Zod：邮箱归一化、密码 8–72 位、邀请码                           |
| Cookie              | `src/lib/auth/session.ts`                                                  | 读写 `httpOnly` Cookie，7 天有效                                |
| 业务编排            | `src/server/services/auth.service.ts`                                      | 注册 / 校验凭据 / 按 id 取用户                                  |
| HTTP                | `src/app/api/auth/{register,login,logout,me}/route.ts` + `src/lib/http.ts` | 统一 `ApiError` 结构与状态码映射                                |
| 路由闸              | `src/middleware.ts`                                                        | `/dashboard*` 未登录跳转 `/login?next=...`                      |
| UI                  | `src/app/login/page.tsx`、`src/components/auth-form.tsx`、`auth-nav.tsx`   | 登录 / 注册表单、导航里的会话状态与退出                         |

安全取舍：首个账号自动 OWNER，之后需 `AUTH_INVITE_CODE`；登录失败统一 401 且用固定 bcrypt 哈希抵消时间差；`next` 在服务端校验，拒绝 `//` 开头的开放重定向；`/api/auth/me` 以数据库为准，删号后旧 JWT 立即失效。

CI 同步改动：`env.AUTH_INVITE_CODE=lumen-dev-invite`（与本机 `.env` 一致）；e2e job 在 `prisma db push` + pgvector DDL 之后增加 `npm run db:seed`；`tests/e2e/smoke.spec.ts` 改为覆盖「未登录拦截 → 种子账号登录 → 邀请码注册 → 退出后再次被拦截」。下一步是 **Step 2 内容模块**（`/api/contents` CRUD + 写作台）。
