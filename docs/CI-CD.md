# CI/CD 设计

## 1. 分支策略

`main` 为保护分支；功能分支 `feat/*`、`fix/*` 通过 PR 合入，**PR 必须 CI 全绿**。每个 PR 自动起预览环境（Vercel Preview 或平台临时实例）。

## 2. CI（`.github/workflows/ci.yml`）

| Job       | 触发           | 内容                                                                                                   |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| `quality` | 所有 push / PR | `npm ci` → `prisma generate` → lint → typecheck → `prisma validate` → Vitest                           |
| `build`   | quality 通过   | `npm run build`（注入占位 env，验证构建期不依赖真实密钥）                                              |
| `e2e`     | build 通过     | 起 `pgvector/pgvector:pg16` service → `db push` → `prisma db execute` 建向量索引 → Playwright Chromium |
| `image`   | 仅 main        | 多阶段 Docker 构建，不推送，用 GHA 缓存加速                                                            |

设计要点：构建期只用占位 env，真实密钥只在运行时注入，避免密钥进入镜像层；`concurrency` 取消同一分支的旧任务，省 CI 时间。

## 3. CD（`.github/workflows/deploy.yml`）

由 `workflow_run` 在 **main 的 CI 成功** 后触发，或手动 `workflow_dispatch`：

1. 构建并推送镜像到 GHCR，打两个 tag：`:sha-<commit>` 与 `:latest`（可回溯、可回滚）。
2. **先改库**：`prisma db push` + pgvector 索引（W2 起改 `migrate deploy`）。迁移必须向前兼容，先加列后改代码。
3. 平台部署（Vercel 或 Railway，配置在 Secrets 里）。
4. **健康检查**：轮询 `/api/health`，20 次 × 10s 内返回 200 才算发布成功；失败即退出非零并提示回滚到上一 `:sha-` tag。
5. `environment: production` 可加人工审批与环境变量隔离。

## 4. Secrets 清单

| Secret                             | 用途                         |
| ---------------------------------- | ---------------------------- |
| `DATABASE_URL`                     | 生产 Postgres（含 pgvector） |
| `AUTH_SECRET`                      | JWT 签名，≥32 字节随机       |
| `AI_API_KEY` / `EMBEDDING_API_KEY` | 模型调用                     |
| `VERCEL_TOKEN` 或 `RAILWAY_TOKEN`  | 平台部署                     |
| `GITHUB_TOKEN`                     | GHCR 推送（workflow 自带）   |

`vars.APP_URL` 为生产域名，供健康检查使用。**任何密钥都不写进 `.env` 提交、不打进日志、不进 `NEXT_PUBLIC_*`。**

## 5. 质量门禁与回滚

- 门禁：lint / typecheck / 单测 / 构建 / E2E 全绿才合入；PR 预览环境人工看一眼效果。
- 回滚：镜像按 commit sha 定版，平台切回上一个 tag；DB 迁移只做加法，回滚应用不破坏数据结构。
- 演练：W4 必须手动触发一次失败健康检查，验证告警与回滚流程真的可用。

## 6. 后续增强

- 单测覆盖率阈值（coverage ≥ 70% 才可合入）。
- 依赖安全扫描（Dependabot + `npm audit`）、镜像扫描（Trivy）。
- 语义化版本与 CHANGELOG 自动生成、发布通知。
