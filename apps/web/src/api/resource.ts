import type { ApiClient, RequestOptions } from './client';

export interface Identifiable {
  id: string;
}

export type ListParams = Record<string, string | number | boolean | undefined>;

export interface ResourceEnvelope {
  list?: string;
  item?: string;
}

export class Resource<T extends Identifiable, Q extends ListParams = ListParams> {
  constructor(
    protected readonly client: ApiClient,
    public readonly path: string,
    protected readonly envelope: ResourceEnvelope = {},
  ) {}

  async list(params?: Q, options?: RequestOptions): Promise<T[]> {
    const res = await this.client.get<unknown>(this.path, { ...options, query: params });
    return this.unwrapList(res);
  }

  async get(id: string, options?: RequestOptions): Promise<T> {
    const res = await this.client.get<unknown>(`${this.path}/${encodeURIComponent(id)}`, options);
    return this.unwrapItem(res);
  }

  async create(body: Partial<T> | Record<string, unknown>, options?: RequestOptions): Promise<T> {
    const res = await this.client.post<unknown>(this.path, body, options);
    return this.unwrapItem(res);
  }

  async update(
    id: string,
    body: Partial<T> | Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<T> {
    const res = await this.client.patch<unknown>(
      `${this.path}/${encodeURIComponent(id)}`,
      body,
      options,
    );
    return this.unwrapItem(res);
  }

  async remove(id: string, options?: RequestOptions): Promise<void> {
    await this.client.delete<unknown>(`${this.path}/${encodeURIComponent(id)}`, options);
  }

  protected unwrapList(res: unknown): T[] {
    if (!this.envelope.list) return res as T[];
    const arr = (res as Record<string, unknown>)[this.envelope.list];
    if (!Array.isArray(arr)) {
      throw new Error(
        `[resource:${this.path}] expected array under '${this.envelope.list}' in response`,
      );
    }
    return arr as T[];
  }

  protected unwrapItem(res: unknown): T {
    if (!this.envelope.item) return res as T;
    const item = (res as Record<string, unknown>)[this.envelope.item];
    if (item == null) {
      throw new Error(`[resource:${this.path}] expected '${this.envelope.item}' field in response`);
    }
    return item as T;
  }
}
