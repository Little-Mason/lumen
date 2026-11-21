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

// ---- W4 · 用量与成本 ----

export type UsageDailyPoint = {
  date: string;
  calls: number;
  successes: number;
  failures: number;
  costCents: number;
  tokens: number;
  p95LatencyMs: number;
};

export type UsageBreakdown = {
  key: string;
  calls: number;
  failures: number;
  costCents: number;
  p95LatencyMs: number;
};

export type UsageTotals = {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  pendingCalls: number;
  /** 0–1，失败数 / 已结束调用数（PENDING 不计入分母）。 */
  failureRate: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCents: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  byKind: UsageBreakdown[];
  byModel: UsageBreakdown[];
  series: UsageDailyPoint[];
};

export type UsageBudget = {
  spentCents: number;
  limitCents: number;
  usedPercent: number;
  remainingCents: number;
  exceeded: boolean;
};

export type UsageFailureDTO = {
  id: string;
  kind: AiJobKind;
  error: string | null;
  latencyMs: number;
  createdAt: string;
};

export type UsageSummaryDTO = {
  generatedAt: string;
  days: number;
  provider: 'mock' | 'openai-compatible';
  model: string;
  totals: UsageTotals;
  budget: UsageBudget;
  recentFailures: UsageFailureDTO[];
};

// ---- W4 · 发布日历 ----

export type CalendarItemDTO = {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  status: ContentStatus;
  /** UTC YYYY-MM-DD：已发布用 publishedAt，草稿/评审用 updatedAt。 */
  date: string;
  publishedAt: string | null;
  wordCount: number;
  href: string;
};

export type CalendarCellDTO = {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  items: CalendarItemDTO[];
};

export type CalendarStatsDTO = {
  publishedCount: number;
  chapterCount: number;
  draftCount: number;
  publishDays: number;
  longestStreak: number;
  totalWords: number;
  lastPublishedAt: string | null;
  daysSinceLastPublish: number | null;
};

export type CalendarDTO = {
  month: string;
  label: string;
  prevMonth: string;
  nextMonth: string;
  cells: CalendarCellDTO[];
  items: CalendarItemDTO[];
  stats: CalendarStatsDTO;
};
