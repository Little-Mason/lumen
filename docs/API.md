# API 契约 v0.1

约定：JSON 请求/响应；除公开读接口外全部需要 `lumen_session` Cookie；错误统一返回
`{ "error": { "code": string, "message": string, "requestId"?: string } }`。所有入参用 Zod 校验，校验失败返回 `400 INVALID_INPUT`。

## 状态码

| 码 | 含义 |
|---|---|
| 200 / 201 | 成功 / 创建成功 |
| 400 | 入参不合法 |
| 401 | 未登录或会话过期 |
| 403 | 已登录但无权操作该资源 |
| 404 | 资源不存在（或未发布） |
| 409 | slug 冲突 |
| 429 | 触发 AI 限流或预算上限 |
| 503 | 依赖降级（DB 或模型不可用） |

## 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 首个账号为 OWNER，之后需邀请码；body: `email, password, name?` |
| POST | `/api/auth/login` | 成功写 httpOnly Cookie；失败统一返回 401，不区分用户是否存在 |
| POST | `/api/auth/logout` | 清 Cookie |
| GET | `/api/auth/me` | 返回当前会话基本信息 |

## 内容

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/contents` | 公开（仅 PUBLISHED） | `?page=1&pageSize=10&type=ARTICLE` → `Paginated<ContentDTO>` |
| GET | `/api/contents/:id` | 登录 | 含 Markdown 全文，供编辑器加载 |
| POST | `/api/contents` | 登录 | 建草稿：`{ title, contentMd, type }`，自动算 slug / 字数 / 阅读时长 |
| PATCH | `/api/contents/:id` | 作者 | 更新正文、标题、标签、状态；正文变化时标记待重新切片 |
| DELETE | `/api/contents/:id` | 作者 | 软归档（`ARCHIVED`），不物理删除 |
| POST | `/api/contents/:id/publish` | 作者 | 置 `PUBLISHED` + `publishedAt`，触发缓存失效与向量化 |
| GET | `/api/tags` | 公开 | 标签列表及计数 |

公开阅读页由 RSC 直接查库，不经 HTTP API；上表用于后台与外部集成。

## AI

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/ai/jobs` | body: `AiJobRequest { kind, contentId?, body, extra? }` → `AiJobResult` |
| GET | `/api/ai/jobs/:id/stream` | SSE 流式输出（长文本润色 / RAG 问答） |
| POST | `/api/ai/ask` | RAG 问答，返回答案 + 引用片段 `contentId/chunkIndex` |
| GET | `/api/ai/usage` | 当前用户按天聚合的调用量、成本、失败率 |
| POST | `/api/contents/:id/reindex` | 手动重建该内容的向量切片 |

`AiJobResult` 示例：

```json
{
  "jobId": "clx...",
  "kind": "OUTLINE",
  "text": "1. 开头：……",
  "promptTokens": 512,
  "completionTokens": 220,
  "costCents": 1,
  "latencyMs": 1840
}
```

**限流**：每用户 `AI_RATE_LIMIT_PER_MIN`（默认 20）次/分钟，Redis 计数；超预算返回 429 并在响应头给 `X-Budget-Reset`。

## 运维

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | `{ status, db, version, latencyMs }`；DB 不可用时 503，供 CI 与容器探针使用 |
| GET | `/api/analytics/overview` | 登录；看板聚合数据 |

## 前端页面

`/`（首页）、`/posts/[slug]`（详情）、`/tags/[slug]`、`/dashboard`（工作台）、`/login`。
`sitemap.xml`、`robots.txt`、`rss.xml` 由 Route Handler 生成（W2）。

> v0.1 仅有 `/api/health` 为已实现接口，其余为**契约先行**：service 层与类型已定义，W2/W3 按本表实现，避免边写边改接口。
