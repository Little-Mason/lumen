export type AiJobKind = 'OUTLINE' | 'TITLE' | 'TAGS' | 'SUMMARIZE' | 'POLISH' | 'RAG_ASK';

export type ContentType = 'ARTICLE' | 'CHAPTER' | 'NOTE';
export type ContentStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export type ContentDTO = {
  id: string;
  type: ContentType;
  status: ContentStatus;
  title: string;
  slug: string;
  excerpt: string | null;
  wordCount: number;
  readingMinutes: number;
  publishedAt: string | null;
  updatedAt: string;
};

/** 列表项额外带标签与作者，供后台与公开列表直接渲染。 */
export type ContentListItemDTO = ContentDTO & {
  tags: string[];
  authorName: string | null;
  viewCount: number;
};

/** 编辑器加载用的完整内容，含 Markdown 全文。 */
export type ContentDetailDTO = ContentListItemDTO & {
  contentMd: string;
  coverUrl: string | null;
  authorId: string;
  createdAt: string;
};

export type TagDTO = { name: string; slug: string; count: number };

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type ApiError = {
  error: { code: string; message: string; requestId?: string };
};

export type AiJobRequest = {
  kind: AiJobKind;
  contentId?: string;
  body: string;
  extra?: string;
};

export type AiJobResult = {
  jobId: string;
  kind: AiJobKind;
  text: string;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  latencyMs: number;
  /** 命中 24h 结果缓存，未产生新的模型调用。 */
  cached?: boolean;
};

export type AiJobStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export type AiJobDTO = {
  id: string;
  kind: AiJobKind;
  status: AiJobStatus;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  latencyMs: number;
  error: string | null;
  contentTitle: string | null;
  createdAt: string;
};

/** SSE done 事件里附带的引用信息。 */
export type RagSourceDTO = {
  contentId: string;
  chunkIndex: number;
  title: string;
  slug: string;
  similarity: number;
  preview: string;
};
