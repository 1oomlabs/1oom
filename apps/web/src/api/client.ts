import { ApiError } from './errors';

export type AuthTokenProvider = () => string | null | undefined;

export interface ApiClientOptions {
  baseUrl: string;

  getAuthToken?: AuthTokenProvider;

  fetchImpl?: typeof fetch;

  defaultHeaders?: Record<string, string>;

  retries?: number;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;

  query?: Record<string, string | number | boolean | undefined>;

  raw?: boolean;
}

export class ApiClient {
  protected readonly baseUrl: string;
  protected readonly fetchImpl: typeof fetch;
  protected readonly defaultHeaders: Record<string, string>;
  protected readonly retries: number;
  protected readonly getAuthToken?: AuthTokenProvider;

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.defaultHeaders = {
      'content-type': 'application/json',
      accept: 'application/json',
      ...opts.defaultHeaders,
    };
    this.retries = opts.retries ?? 0;
    this.getAuthToken = opts.getAuthToken;
  }

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, query, raw, headers, ...rest } = options;
    const url = this.buildUrl(path, query);
    const headersFinal = this.buildHeaders(headers);

    const init: RequestInit = {
      ...rest,
      headers: headersFinal,
      body: this.serialiseBody(body),
    };

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const res = await this.fetchImpl(url, init);
        if (!res.ok) {
          const errBody = await safeReadJson(res);
          throw new ApiError({
            message: `${res.status} ${res.statusText}`,
            status: res.status,
            url,
            body: errBody,
          });
        }
        if (raw) return res as unknown as T;
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      } catch (err) {
        lastErr = err;
        if (err instanceof ApiError && err.isClientError()) throw err;
        if (attempt === this.retries) {
          if (err instanceof ApiError) throw err;
          throw ApiError.network(url, err);
        }

        await wait(200 * 2 ** attempt);
      }
    }
    throw lastErr;
  }

  get<T>(path: string, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }
  post<T>(path: string, body?: RequestOptions['body'], options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }
  put<T>(path: string, body?: RequestOptions['body'], options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }
  patch<T>(path: string, body?: RequestOptions['body'], options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }
  delete<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const base = `${this.baseUrl}${cleanPath}`;
    if (!query) return base;
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      search.set(k, String(v));
    }
    const qs = search.toString();
    return qs ? `${base}?${qs}` : base;
  }

  private buildHeaders(extra?: HeadersInit): HeadersInit {
    const out = new Headers(this.defaultHeaders);
    if (extra) {
      const incoming = new Headers(extra);
      incoming.forEach((v, k) => out.set(k, v));
    }
    const token = this.getAuthToken?.();
    if (token) out.set('authorization', `Bearer ${token}`);
    return out;
  }

  private serialiseBody(body: RequestOptions['body']): BodyInit | null | undefined {
    if (body == null) return undefined;
    if (typeof body === 'string') return body;
    if (body instanceof FormData) return body;
    if (body instanceof Blob) return body;
    if (body instanceof ArrayBuffer) return body;
    if (body instanceof URLSearchParams) return body;
    return JSON.stringify(body);
  }
}

async function safeReadJson(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? '/api',
});
