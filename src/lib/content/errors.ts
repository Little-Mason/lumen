/** 内容领域错误：service 抛出，Route Handler 统一映射成 HTTP 状态码。 */
export type ContentErrorCode =
  'UNAUTHORIZED' | 'NOT_FOUND' | 'FORBIDDEN' | 'SLUG_TAKEN' | 'INVALID_TRANSITION';

const STATUS: Record<ContentErrorCode, number> = {
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  SLUG_TAKEN: 409,
  INVALID_TRANSITION: 409,
};

export class ContentError extends Error {
  constructor(
    readonly code: ContentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ContentError';
  }

  get status(): number {
    return STATUS[this.code];
  }
}
