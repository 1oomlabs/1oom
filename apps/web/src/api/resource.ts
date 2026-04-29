import { ZodError } from 'zod';

import type { ApiClient, RequestOptions } from './client';

export interface Identifiable {
  id: string;
}

export type ListParams = Record<string, string | number | boolean | undefined>;

export interface ResourceEnvelope {
  list?: string;
  item?: string;
}

/**
 * Structural shape of any zod schema that parses unknown input into T.
 * Avoids zod's three-parameter ZodType<Output, Def, Input> generic that
 * mismatches when schemas use .default() / .optional() (input differs from
 * output). Any zod schema satisfies this contract.
 */
export interface SchemaLike<T> {
  parse: (value: unknown) => T;
}

export class Resource<T extends Identifiable, Q extends ListParams = ListParams> {
  constructor(
    protected readonly client: ApiClient,
    public readonly path: string,
    protected readonly envelope: ResourceEnvelope = {},
    protected readonly schema?: SchemaLike<T>,
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
    const raw: unknown = this.envelope.list
      ? (res as Record<string, unknown>)[this.envelope.list]
      : res;
    if (!Array.isArray(raw)) {
      throw new Error(
        `[resource:${this.path}] expected array under '${this.envelope.list ?? '<root>'}' in response`,
      );
    }
    if (this.schema) {
      const schema = this.schema;
      return raw.map((item, i) => this.parseOrThrow(schema, item, `[${i}]`));
    }
    return raw as T[];
  }

  protected unwrapItem(res: unknown): T {
    const raw: unknown = this.envelope.item
      ? (res as Record<string, unknown>)[this.envelope.item]
      : res;
    if (raw == null) {
      throw new Error(`[resource:${this.path}] expected '${this.envelope.item}' field in response`);
    }
    return this.schema ? this.parseOrThrow(this.schema, raw, '') : (raw as T);
  }

  private parseOrThrow(schema: SchemaLike<T>, value: unknown, location: string): T {
    try {
      return schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; ');
        throw new Error(`[resource:${this.path}${location}] schema validation failed: ${issues}`);
      }
      throw err;
    }
  }
}
