export type AiJobKind =
  | 'OUTLINE'
  | 'TITLE'
  | 'TAGS'
  | 'SUMMARIZE'
  | 'POLISH'
  | 'RAG_ASK';

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
};
