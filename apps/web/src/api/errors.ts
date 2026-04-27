/**
 * Error type thrown by ApiClient. Wraps HTTP failures and network failures
 * in a single shape so call sites can branch on `status` consistently.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  readonly url: string;
  readonly body: unknown;

  constructor(opts: { message: string; status: number; url: string; body?: unknown }) {
    super(opts.message);
    this.status = opts.status;
    this.url = opts.url;
    this.body = opts.body;
  }

  /** Network failure / aborted / DNS / fetch threw before getting a response. */
  static network(url: string, cause: unknown): ApiError {
    const msg = cause instanceof Error ? cause.message : 'Network error';
    return new ApiError({ message: msg, status: 0, url, body: cause });
  }

  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
  isServerError(): boolean {
    return this.status >= 500;
  }
  isNetwork(): boolean {
    return this.status === 0;
  }
}
