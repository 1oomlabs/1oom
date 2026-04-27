import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '../client';
import type { ApiError } from '../errors';
import { type MutationOpts, type ResourceHooks, makeResourceHooks } from '../hooks';
import { Resource } from '../resource';
import type { Workflow } from './workflows';

export interface MarketplaceListing {
  id: string;
  workflow: Workflow;
  author: string;
  tags: string[];
  pricing: { type: 'free' } | { type: 'x402'; amount: string; token: string };
  stats: { installs: number; runs: number };
  createdAt: number;
}

export interface MarketplaceListParams
  extends Record<string, string | number | boolean | undefined> {
  protocol?: string;
  tag?: string;
  author?: string;
  sort?: 'newest' | 'popular';
  limit?: number;
  cursor?: string;
}

class MarketplaceResource extends Resource<MarketplaceListing, MarketplaceListParams> {
  /** Install a listing into the caller's account, optionally paying via x402. */
  install(id: string): Promise<{ ok: true; workflowId: string }> {
    return this.client.post<{ ok: true; workflowId: string }>(
      `${this.path}/${encodeURIComponent(id)}/install`,
    );
  }
}

export const marketplaceResource = new MarketplaceResource(apiClient, '/marketplace');

const baseHooks = makeResourceHooks<MarketplaceListing, MarketplaceListParams>(marketplaceResource);

const { keys: marketplaceKeys, useList, useOne, useCreate, useRemove, useInvalidate } = baseHooks;

export { marketplaceKeys };
export const useMarketplaceList: ResourceHooks<
  MarketplaceListing,
  MarketplaceListParams
>['useList'] = useList;
export const useMarketplaceListing: ResourceHooks<
  MarketplaceListing,
  MarketplaceListParams
>['useOne'] = useOne;
export const usePublishToMarketplace: ResourceHooks<
  MarketplaceListing,
  MarketplaceListParams
>['useCreate'] = useCreate;
export const useUnpublishListing: ResourceHooks<
  MarketplaceListing,
  MarketplaceListParams
>['useRemove'] = useRemove;
export const useInvalidateMarketplace: ResourceHooks<
  MarketplaceListing,
  MarketplaceListParams
>['useInvalidate'] = useInvalidate;

export function useInstallListing(
  options?: MutationOpts<{ ok: true; workflowId: string }, string>,
): UseMutationResult<{ ok: true; workflowId: string }, ApiError, string> {
  const qc = useQueryClient();
  return useMutation<{ ok: true; workflowId: string }, ApiError, string>({
    ...options,
    mutationFn: (id) => marketplaceResource.install(id),
    onSuccess: (...args) => {
      const [, id] = args;
      qc.invalidateQueries({ queryKey: marketplaceKeys.detail(id) });
      return options?.onSuccess?.(...args);
    },
  });
}
