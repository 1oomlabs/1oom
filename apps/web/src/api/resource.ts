import type { ApiClient, RequestOptions } from './client';

/** Minimum shape every resource entity must satisfy. */
export interface Identifiable {
  id: string;
}

export type ListParams = Record<string, string | number | boolean | undefined>;

/**
 * Base class for any REST-shaped resource. Subclass this to add
 * resource-specific methods (e.g. `runWorkflow`). Each instance is bound
 * to a single `path` (e.g. `/workflows`) and reuses a shared `ApiClient`.
 *
 * Example:
 *
 * ```ts
 * class WorkflowsResource extends Resource<Workflow> {
 *   run(id: string) {
 *     return this.client.post<{ ok: true }>(`${this.path}/${id}/run`);
 *   }
 * }
 *
 * export const workflowsResource = new WorkflowsResource(apiClient, '/workflows');
 * ```
 */
export class Resource<T extends Identifiable, Q extends ListParams = ListParams> {
  constructor(
    protected readonly client: ApiClient,
    public readonly path: string,
  ) {}

  list(params?: Q, options?: RequestOptions): Promise<T[]> {
    return this.client.get<T[]>(this.path, { ...options, query: params });
  }

  get(id: string, options?: RequestOptions): Promise<T> {
    return this.client.get<T>(`${this.path}/${encodeURIComponent(id)}`, options);
  }

  create(body: Partial<T> | Record<string, unknown>, options?: RequestOptions): Promise<T> {
    return this.client.post<T>(this.path, body, options);
  }

  update(
    id: string,
    body: Partial<T> | Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<T> {
    return this.client.patch<T>(`${this.path}/${encodeURIComponent(id)}`, body, options);
  }

  remove(id: string, options?: RequestOptions): Promise<void> {
    return this.client.delete<void>(`${this.path}/${encodeURIComponent(id)}`, options);
  }
}
