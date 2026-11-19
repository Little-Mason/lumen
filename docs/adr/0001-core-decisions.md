# ADR 0001 · 核心技术选型

- 日期：2026-11-19
- 状态：已接受
- 背景：单人、4 周、需同时满足「可上线的自媒体站点」与「面试可讲的全栈 + AI + CI/CD 作品」

## 决策 1：Next.js 15 单体全栈，不前后端分离

- **备选**：React SPA + NestJS/Express 独立后端
- **选择**：App Router 一套代码覆盖页面、Server Actions、Route Handlers
- **理由**：单人 4 周，减少两套部署、两套类型定义、CORS 与联调成本；RSC 让公开站首屏更轻
- **代价**：前后端无法独立扩缩容；重 CPU 的 AI 任务会占用应用进程 → 演进路线里已写明队列化

## 决策 2：PostgreSQL + pgvector，不引入独立向量数据库

- **备选**：Pinecone / Qdrant / Milvus
- **选择**：`pgvector/pgvector:pg16`，`ContentChunk.embedding Unsupported("vector(1536)")` + HNSW 索引
- **理由**：关系数据与向量同库，发布/删除内容可事务一致；少一个组件与一套运维；数据量预期 < 10 万切片
- **代价**：超大规模需迁移到专用向量库；Prisma 不支持 vector 类型，写入与检索必须走参数化 `$queryRaw`

## 决策 3：JWT 无状态会话，不用 DB Session / 第三方 Auth

- **选择**：jose HS256 + httpOnly Cookie + bcryptjs
- **理由**：部署无状态、可水平扩展、无外部依赖；实现细节可完整讲给面试官
- **代价**：无法即时吊销 → 短 TTL(7d) + 退出清 Cookie；若做多端强制下线需加黑名单

## 决策 4：AI 走 OpenAI 兼容协议 + Provider 抽象

- **选择**：Vercel AI SDK v4，`chatProvider` 与 `embeddingProvider` 分开配置
- **理由**：DeepSeek 便宜但**没有 embedding 接口**，必须双 provider；换模型只改 `.env`，业务代码零改动
- **代价**：兼容模式下部分厂商特性不可用；成本表是估算口径而非账单

## 决策 5：AI 调用统一编排并落库记账

- **选择**：`ai.service` 为唯一入口，`AiJob` 表记录 token / 成本 / 延迟 / 状态 / 错误
- **理由**：限流、缓存、重试、预算熔断只有一处可实现；看板与面试素材都来自真实数据
- **代价**：多一次数据库写（异步化可优化，已列入演进）

## 决策 6：W1 用 `prisma db push`，W2 切 `migrate deploy`

- **理由**：第一周 schema 会频繁调整，生成一堆无意义迁移文件反而干扰；W2 功能稳定后必须建立迁移历史
- **约束**：**W2 验收项包含提交第一份迁移文件**，之后 CI/CD 只允许 `migrate deploy`

## 决策 7：Docker standalone 输出 + GHCR `:sha-` 镜像

- **理由**：镜像小、启动快；按 commit 定版才能可靠回滚；构建期用占位 env，真实密钥运行时注入
- **代价**：standalone 不含 Prisma CLI，迁移必须在 CI job 里单独执行（已写进 `deploy.yml`）

## 结果

以上决策共同保证：**一个月内能上线、每一层都能在面试里讲出为什么、且有明确的下一步演进路径**。任何一条被推翻时，请新建 ADR，不要直接改本文。
