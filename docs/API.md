# API 契约 v0.1

约定：JSON 请求/响应；除公开读接口外全部需要 `lumen_session` Cookie；错误统一返回
`{ "error": { "code": string, "message": string, "requestId"?: string } }`。所有入参用 Zod 校验，校验失败返回 `400 INVALID_INPUT`。

## 状态码

| 码        | 含义                        |
| --------- | --------------------------- |
| 200 / 201 | 成功 / 创建成功             |
| 400       | 入参不合法                  |
| 401       | 未登录或会话过期            |
| 403       | 已登录但无权操作该资源      |
| 404       | 资源不存在（或未发布）      |
| 409       | slug 冲突                   |
| 429       | 触发 AI 限流或预算上限      |
| 503       | 依赖降级（DB 或模型不可用） |

## 认证

| 方法 | 路径                 | 说明                                                                                                                                       |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| POST | `/api/auth/register` | ✅ 已实现。首个账号为 OWNER 且无需邀请码，之后需 `AUTH_INVITE_CODE`；body: `email, password, name?, inviteCode?`；成功写 Cookie 并返回 201 |
| POST | `/api/auth/login`    | ✅ 已实现。成功写 httpOnly Cookie；失败统一返回 401 `INVALID_CREDENTIALS`，不区分用户是否存在                                              |
| POST | `/api/auth/logout`   | ✅ 已实现。幂等清 Cookie                                                                                                                   |
| GET  | `/api/auth/me`       | ✅ 已实现。以数据库为准，账号被删后旧 JWT 也返回 401                                                                                       |

## 内容

| 方法   | 路径                          | 权限                 | 说明                                                                                                       |
| ------ | ----------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| GET    | `/api/contents`               | 公开（仅 PUBLISHED） | ✅ `?page=1&pageSize=10&type=ARTICLE&tag=<slug>&q=` → `Paginated<ContentListItemDTO>`                      |
| GET    | `/api/contents/:id`           | 登录（作者）         | ✅ 含 Markdown 全文，供编辑器加载                                                                          |
| POST   | `/api/contents`               | 登录                 | ✅ 建草稿：`{ title, contentMd, type?, excerpt?, coverUrl?, tags? }`，自动算 slug / 摘要 / 字数 / 阅读时长 |
| PATCH  | `/api/contents/:id`           | 作者                 | ✅ 更新正文、标题、标签、状态；改正文会重算字数与摘要，slug 保持不变                                       |
| DELETE | `/api/contents/:id`           | 作者                 | ✅ 软归档（`ARCHIVED`），不物理删除                                                                        |
| POST   | `/api/contents/:id/publish`   | 作者                 | ✅ 置 `PUBLISHED` + `publishedAt`，幂等                                                                    |
| POST   | `/api/contents/:id/unpublish` | 作者                 | ✅ 下线回 `DRAFT`，保留 `publishedAt` 历史                                                                 |
| GET    | `/api/tags`                   | 公开                 | ✅ 标签列表及已发布内容计数                                                                                |

公开阅读页由 RSC 直接查库，不经 HTTP API；上表用于后台与外部集成。
写接口统一经 `requireUser()`：校验 JWT 且确认账号仍在库中，删号后旧 Cookie 立即失效。
状态流转由 `canTransition()` 约束；非法流转返回 `409 INVALID_TRANSITION`，越权返回 `403 FORBIDDEN`。

## AI（W3 已实现）

| 方法 | 路径                        | 权限 | 说明                                                                                       |
| ---- | --------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| POST | `/api/ai/run`               | 登录 | 五种写作能力 `OUTLINE/TITLE/TAGS/SUMMARIZE/POLISH`；`stream:false` 返回 JSON，`true` 返回 SSE |
| POST | `/api/ai/ask`               | 登录 | RAG 问答：`{ question, contentId?, stream? }`，先 HNSW 检索再流式回答，附引用列表          |
| GET  | `/api/ai/jobs`              | 登录 | 当前用户调用流水 `?page=1&pageSize=20&kind=&status=` → `Paginated<AiJobDTO>`             |
| POST | `/api/contents/:id/reindex` | 作者 | 手动重建切片，返回 `{ contentId, chunks }`；索引失败不阻断发布                            |

`POST /api/ai/run` body：`{ kind, body, contentId?, extra?, stream? }`。`contentId` 必须是本人内容，否则 404。
`POST /api/ai/ask` 默认 `stream:true`；`contentId` 只用于把检索限定到某篇内容。

非流式响应：

```json
{
  "result": {
    "jobId": "clx...",
    "kind": "OUTLINE",
    "text": "1. 引言：……",
    "promptTokens": 512,
    "completionTokens": 220,
    "costCents": 1,
    "latencyMs": 1840,
    "cached": false
  }
}
```

流式响应 `Content-Type: text/event-stream`，事件顺序固定为
`meta`（jobId / kind / model / sources）→ 若干 `delta`（`{ "text": "..." }`）→ `done`（完整 `AiJobResult` + sources）；
模型失败则发 `error`（`{ code, message }`）并收尾，同时把该 Job 记为 `FAILED`。

**限流与降级**：每用户 `AI_RATE_LIMIT_PER_MIN`（默认 20）次/分钟；配置 `REDIS_URL` 时走 Redis `INCR + EXPIRE`，否则降级到进程内计数器。月度预算按当月 `AiJob.costCents` 汇总，超限返回 `429 BUDGET_EXCEEDED`；限流返回 `429 RATE_LIMITED` 并带 `Retry-After`。模型失败返回 `502 PROVIDER_ERROR`。成本为估算口径（非账单）。

**未实现的契约**：`/api/ai/usage` 与 `/api/analytics/overview` 属于 W4 用量看板，暂未开放。

## 运维

| 方法 | 路径                      | 说明                                                                        |
| ---- | ------------------------- | --------------------------------------------------------------------------- |
| GET  | `/api/health`             | `{ status, db, version, latencyMs }`；DB 不可用时 503，供 CI 与容器探针使用 |
| GET  | `/api/analytics/overview` | 登录；看板聚合数据                                                          |

## 前端页面

`/`（首页）、`/posts/[slug]`（详情）、`/tags/[slug]`、`/dashboard`（工作台）、`/dashboard/content`、`/dashboard/ai`、`/login`。
`sitemap.xml`、`rss.xml` 由 Route Handler 生成，`robots.txt` 为静态文件。

> v0.3 已实现 `/api/health`、`/api/auth/*`、全部 `/api/contents/*`、`/api/tags` 与 AI 三件套（`/api/ai/run`、`/api/ai/ask`、`/api/ai/jobs`）。AI 默认走确定性 mock provider，填入密钥并把 `AI_PROVIDER` 改为 `openai-compatible` 即可切真模型，业务代码不变。
>
> 认证细节：`AUTH_SECRET` 签 HS256 JWT，7 天有效；Cookie 为 `httpOnly + sameSite=lax`，生产环境加 `secure`。`src/middleware.ts` 只用 jose 校验签名（Edge 安全，不查库、不引 bcrypt），未登录访问 `/dashboard*` 跳转 `/login?next=...`；业务权限仍由 service 层判定。注册首个账号后默认关闭，需配置 `AUTH_INVITE_CODE`。登录失败会做一次固定 bcrypt 比较，避免用响应时间枚举邮箱。
