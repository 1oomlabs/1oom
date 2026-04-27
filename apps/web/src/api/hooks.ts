import {
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { ApiError } from './errors';
import { type QueryKeyFactory, makeQueryKeys } from './keys';
import type { Identifiable, ListParams, Resource } from './resource';

/** Options accepted by query hooks (excluding what we own: queryKey, queryFn). */
export type QueryOpts<T> = Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>;

/** Options accepted by mutation hooks (we provide mutationFn). */
export type MutationOpts<TData, TVars> = Omit<
  UseMutationOptions<TData, ApiError, TVars>,
  'mutationFn'
>;

export interface ResourceHooks<T extends Identifiable, Q extends ListParams> {
  /** Stable query-key factory bound to this resource. */
  keys: QueryKeyFactory;

  /** Underlying resource (escape hatch for custom calls). */
  resource: Resource<T, Q>;

  /** GET /resource — list with optional filter params. */
  useList: (params?: Q, options?: QueryOpts<T[]>) => UseQueryResult<T[], ApiError>;

  /** GET /resource/:id — single entity, disabled when id is falsy. */
  useOne: (id: string | undefined, options?: QueryOpts<T>) => UseQueryResult<T, ApiError>;

  /** POST /resource — create, returns the newly created entity. */
  useCreate: <TBody extends Partial<T> | Record<string, unknown> = Partial<T>>(
    options?: MutationOpts<T, TBody>,
  ) => UseMutationResult<T, ApiError, TBody>;

  /** PATCH /resource/:id — update by id. */
  useUpdate: <TBody extends Partial<T> | Record<string, unknown> = Partial<T>>(
    options?: MutationOpts<T, { id: string; body: TBody }>,
  ) => UseMutationResult<T, ApiError, { id: string; body: TBody }>;

  /** DELETE /resource/:id. */
  useRemove: (options?: MutationOpts<void, string>) => UseMutationResult<void, ApiError, string>;

  /** Invalidate all queries for this resource. */
  useInvalidate: () => () => Promise<void>;
}

/**
 * Bind a `Resource<T>` to a full set of TanStack Query hooks.
 *
 * Subclasses of `Resource` automatically benefit — pass an instance of the
 * subclass and the hooks below operate against it. Add resource-specific
 * mutations alongside these in the resource's own file.
 */
export function makeResourceHooks<T extends Identifiable, Q extends ListParams = ListParams>(
  resource: Resource<T, Q>,
): ResourceHooks<T, Q> {
  const keys = makeQueryKeys(resource.path);

  const useList: ResourceHooks<T, Q>['useList'] = (params, options) =>
    useQuery<T[], ApiError>({
      ...options,
      queryKey: keys.list(params),
      queryFn: () => resource.list(params),
    });

  const useOne: ResourceHooks<T, Q>['useOne'] = (id, options) =>
    useQuery<T, ApiError>({
      ...options,
      queryKey: keys.detail(id ?? ''),
      // queryFn is gated by `enabled` below; id is guaranteed truthy when called.
      queryFn: () => resource.get(id as string),
      enabled: Boolean(id) && options?.enabled !== false,
    });

  const useCreate: ResourceHooks<T, Q>['useCreate'] = <
    TBody extends Partial<T> | Record<string, unknown> = Partial<T>,
  >(
    options?: MutationOpts<T, TBody>,
  ) => {
    const qc = useQueryClient();
    return useMutation<T, ApiError, TBody>({
      ...options,
      mutationFn: (body) => resource.create(body),
      onSuccess: (...args) => {
        qc.invalidateQueries({ queryKey: keys.all() });
        return options?.onSuccess?.(...args);
      },
    });
  };

  const useUpdate: ResourceHooks<T, Q>['useUpdate'] = <
    TBody extends Partial<T> | Record<string, unknown> = Partial<T>,
  >(
    options?: MutationOpts<T, { id: string; body: TBody }>,
  ) => {
    const qc = useQueryClient();
    return useMutation<T, ApiError, { id: string; body: TBody }>({
      ...options,
      mutationFn: ({ id, body }) => resource.update(id, body),
      onSuccess: (...args) => {
        const [, vars] = args;
        qc.invalidateQueries({ queryKey: keys.detail(vars.id) });
        qc.invalidateQueries({ queryKey: keys.all() });
        return options?.onSuccess?.(...args);
      },
    });
  };

  const useRemove: ResourceHooks<T, Q>['useRemove'] = (options) => {
    const qc = useQueryClient();
    return useMutation<void, ApiError, string>({
      ...options,
      mutationFn: (id) => resource.remove(id),
      onSuccess: (...args) => {
        const [, id] = args;
        qc.invalidateQueries({ queryKey: keys.detail(id) });
        qc.invalidateQueries({ queryKey: keys.all() });
        return options?.onSuccess?.(...args);
      },
    });
  };

  const useInvalidate: ResourceHooks<T, Q>['useInvalidate'] = () => {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: keys.all() });
  };

  return { keys, resource, useList, useOne, useCreate, useUpdate, useRemove, useInvalidate };
}
