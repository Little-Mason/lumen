/** 认证领域错误：由 service 抛出，由 Route Handler 映射成 HTTP 状态码。 */
export class AuthError extends Error {
  constructor(
    readonly code: 'EMAIL_TAKEN' | 'INVITE_REQUIRED',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
