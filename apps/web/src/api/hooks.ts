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

export type QueryOpts<T> = Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>;

export type MutationOpts<TData, TVars> = Omit<
  UseMutationOptions<TData, ApiError, TVars>,
  'mutationFn'
>;

export interface ResourceHooks<T extends Identifiable, Q extends ListParams> {
  keys: QueryKeyFactory;

  resource: Resource<T, Q>;

  useList: (params?: Q, options?: QueryOpts<T[]>) => UseQueryResult<T[], ApiError>;

  useOne: (id: string | undefined, options?: QueryOpts<T>) => UseQueryResult<T, ApiError>;

  useCreate: <TBody extends Partial<T> | Record<string, unknown> = Partial<T>>(
    options?: MutationOpts<T, TBody>,
  ) => UseMutationResult<T, ApiError, TBody>;

  useUpdate: <TBody extends Partial<T> | Record<string, unknown> = Partial<T>>(
    options?: MutationOpts<T, { id: string; body: TBody }>,
  ) => UseMutationResult<T, ApiError, { id: string; body: TBody }>;

  useRemove: (options?: MutationOpts<void, string>) => UseMutationResult<void, ApiError, string>;

  useInvalidate: () => () => Promise<void>;
}

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

export function useResourceMutation<TData, TVars>(config: {
  mutationFn: (vars: TVars) => Promise<TData>;
  invalidate?: (data: TData, vars: TVars) => readonly (readonly unknown[])[];
  options?: MutationOpts<TData, TVars>;
}): UseMutationResult<TData, ApiError, TVars> {
  const { mutationFn, invalidate, options } = config;
  const qc = useQueryClient();
  return useMutation<TData, ApiError, TVars>({
    ...options,
    mutationFn,
    onSuccess: (...args) => {
      if (invalidate) {
        const [data, vars] = args;
        for (const key of invalidate(data, vars)) {
          qc.invalidateQueries({ queryKey: key });
        }
      }
      return options?.onSuccess?.(...args);
    },
  });
}
