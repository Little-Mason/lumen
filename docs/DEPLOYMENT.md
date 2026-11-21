# 部署与本地环境

## 1. 本地开发

```bash
docker compose up -d          # Postgres(pgvector) :5432 + Redis :6379
cp .env.example .env
npm install
npx prisma db execute --file prisma/sql/000_extensions.sql --schema prisma/schema.prisma
npx prisma migrate deploy
npx prisma db execute --file prisma/sql/001_pgvector.sql --schema prisma/schema.prisma
npm run db:seed
npm run dev
```

`AUTH_SECRET` 生成：`openssl rand -base64 32`。种子账号默认 `owner@lumen.local / change-me-123`，**仅本地使用**，可用 `SEED_OWNER_*` 覆盖。

## 2. 三种生产形态

| 方案          | 组合                                           | 适合                               | 注意                                                                                             |
| ------------- | ---------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| A（推荐起步） | Vercel + Neon/Supabase Postgres                | 零运维、PR 预览、自动 HTTPS        | 需确认供应商支持 `vector` 扩展；Serverless 下 Prisma 要用连接池（PgBouncer / `?pgbouncer=true`） |
| B             | Railway / Render + 同平台 Postgres + GHCR 镜像 | 与本地 Docker 完全一致，链路最好讲 | 容器常驻，注意 `output: 'standalone'` 与迁移时机                                                 |
| C             | 单台 VPS + `docker compose`                    | 最便宜、完全可控                   | 自己管备份、证书、监控                                                                           |

**域名与 HTTPS**：平台托管证书即可；`NEXT_PUBLIC_SITE_URL` 设为正式域名，影响 OG、sitemap、RSS 的绝对地址。

## 3. 数据库迁移规范

- 首份迁移 `prisma/migrations/20261121000000_init` 已提交，CI/CD 统一 `prisma migrate deploy`；本地开发不要再 `db push`，改 schema 后用 `npm run db:migrate` 生成新迁移。
- 迁移前先执行 `prisma/sql/000_extensions.sql`：`CREATE EXTENSION vector` 需要管理员权限，托管 Postgres（Neon / Supabase）请在平台 SQL 编辑器先建一次；扩展已存在时该文件只是安全的 no-op。**不要**把建扩展写进迁移，否则非超级用户的应用角色会在 `migrate deploy` 直接失败。
- `prisma/sql/001_pgvector.sql` 在迁移完成后执行一次：建 `vector` 扩展兜底与 HNSW 索引。
- **换 embedding 模型的迁移清单**：改 `schema.prisma` 的 `vector(N)` → 改 SQL 索引 → 改 `.env` 的 `EMBEDDING_DIM` → 清空 `ContentChunk` → 全量重新切片向量化。

## 4. 上线前检查单

- [ ] `/api/health` 返回 200 且 `db: up`
- [ ] 生产 `AUTH_SECRET` 非占位值，Cookie `Secure` 生效
- [ ] 数据库自动备份已开启，恢复流程演练过一次
- [ ] AI 预算上限与限流已配置，日志脱敏生效
- [ ] sitemap / robots / OG 用的是正式域名
- [ ] Sentry（或等价错误上报）能收到一条测试错误
- [ ] CI → CD 全流程自动跑通，健康检查失败时能回滚

## 5. 备份与监控

- 每日自动备份 Postgres；`ContentChunk` 可由内容重建，备份策略可降优先级。
- 监控三件事：可用性（`/api/health`）、AI 成本（AiJob 日聚合）、错误率（Sentry）。
- 告警阈值：健康检查连续 3 次失败、日成本超过预算 20%、AI 失败率 > 5%。

## 6. 常见问题

| 现象                               | 排查                                                                  |
| ---------------------------------- | --------------------------------------------------------------------- |
| `prisma db push` 报 extension 权限 | 确认镜像是 `pgvector/pgvector:pg16`，或手动 `CREATE EXTENSION vector` |
| Serverless 下连接数打满            | 加连接池参数，复用全局 `PrismaClient`（`src/lib/db.ts` 已处理 HMR）   |
| AI 返回 401                        | 检查 `AI_BASE_URL` 是否带 `/v1`，DeepSeek 与 OpenAI 路径不同          |
| 向量检索很慢                       | 确认 HNSW 索引已建、`WHERE embedding IS NOT NULL` 与索引条件一致      |
