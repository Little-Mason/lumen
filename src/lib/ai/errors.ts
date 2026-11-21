/** AI 领域错误：service 抛出，Route Handler 统一映射成 HTTP 状态码。 */
export type AiErrorCode =
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'BUDGET_EXCEEDED'
  | 'PROVIDER_ERROR'
  | 'DIM_MISMATCH'
  | 'INDEX_FAILED';

const STATUS: Record<AiErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  BUDGET_EXCEEDED: 429,
  PROVIDER_ERROR: 502,
  DIM_MISMATCH: 500,
  INDEX_FAILED: 500,
};

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }

  get status(): number {
    return STATUS[this.code];
  }
}
