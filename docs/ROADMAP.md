# 四周开发路线（2026-11-19 → 2026-12-19）

与每日打卡表对应：阶段 A 每天 6 小时项目时间。每周五收尾、周日复盘，**验收不通过不进下一周**，顺延的内容用周末补，不熬夜。

## W1 · 11/19–11/25　地基与门禁

- [x] 仓库初始化、目录结构、技术选型与 ADR
- [x] `.env` 校验、Prisma schema、pgvector SQL、种子数据
- [x] CI 流水线（lint / typecheck / schema / unit / build / E2E / 镜像）
- [x] 架构文档、接口契约、部署与面试文档
- [x] 认证闭环：注册 / 登录 / 登出 / 会话校验中间件（Gate B，commit `176485d`）
- [ ] `/api/health` 在容器与健康检查中返回 200

**验收**：push 到 main 后 CI 全绿；本地 `npm run dev` 能打开首页与工作台；`db push` 无报错。

**风险**：Next 15 + React 19 与部分库版本不兼容 → 先 `npm install` 把锁文件提交，再写业务代码。

## W2 · 11/26–12/02　内容闭环

- [x] 内容 CRUD：草稿、自动 slug、字数/阅读时长、状态流转、标签
- [x] 写作台：Markdown 编辑 + 预览、列表筛选、发布/下线
- [x] 公开站：列表、详情、标签页、Markdown 渲染、OG / sitemap / RSS
- [x] 单元测试覆盖 service 层（38 个用例）；E2E 覆盖「登录 → 写 → 发布 → 匿名窗口可见」
- [x] **生成并提交第一份 Prisma 迁移文件，CI 从 `db push` 切到 `migrate deploy`**

**验收**：从后台发一篇技术文章，匿名窗口能访问且 `view source` 有正确 meta 描述。

**风险**：RSC 与客户端编辑器状态混合容易乱 → 编辑器单独隔离为客户端组件，数据通过 Server Action 提交。

## W3 · 12/03–12/09　AI 与 RAG

- [x] 五种能力：OUTLINE / TITLE / TAGS / SUMMARIZE / POLISH，接 `ai.service` 契约
- [x] SSE 流式输出、Zod 入参校验、Redis 限流（未配置时进程内降级）、预算熔断
- [x] 切片 → embedding → `ContentChunk` 写入 → HNSW 检索 → 带出处回答
- [x] prompt 防注入用例测试；失败重试与 AiJob 记账完整
- [x] E2E 覆盖 AI 调用（用 mock provider，避免 CI 消耗真实 token）

**W3 完成说明**：默认 `AI_PROVIDER=mock`（确定性假模型 + 哈希词袋 embedding），零密钥零 token 即可跑完整闭环；填密钥切 `openai-compatible` 即接真模型。发布自动重建切片、下线/归档自动删除，索引失败不阻断发布。单测 82/82，详见 `docs/AI-DESIGN.md` 第 7 节。W1 的 `/api/health` 容器健康检查项仍未实测，随 W4 上线一起收尾。

**验收**：对已发布内容提问，回答只引用库内片段；`AiJob` 表能看到 token、成本、延迟。

**风险**：DeepSeek 无 embedding 接口 → 聊天与 embedding 分两个 provider；若国内网络不通，切硅基流动 bge-m3 并同步把维度改为 1024、重建列与索引。

## W4 · 12/10–12/19　上线与包装

- [ ] 用量看板：调用量、成本、失败率、P95 延迟、发布日历
- [ ] 生产部署：托管 Postgres + 应用平台 + 自定义域名 + HTTPS + Sentry
- [ ] 发布流水线：迁移 → 镜像 → 健康检查 → 失败回滚演练一次
- [ ] 产出 2 篇技术文章（架构选型 / RAG 落地踩坑），发布到 Lumen 自身并同步自媒体
- [ ] README 补演示视频与截图；`docs/INTERVIEW.md` 补真实指标

**验收**：在线链接可访问、CI→CD 全自动、README 让陌生人 5 分钟跑起来；简历项目描述能讲 3 分钟。

## 之后的维护节奏（12/20 起）

每天 1h：修 bug、补内容、跟进依赖；每周 1 篇技术文 / 1 条短视频素材。雅思考完后把省下的时间投到项目第 2 期（队列化 AI 任务、多租户）。

## 每周复盘要写的四个数

模考分 · 体重周均 · 累计章节 · 代码提交数（打卡表里已内置）。项目这边额外看一条：**本周有没有一个能被外人看见的交付物**，没有就说明时间花在重构上了，下周调整。
