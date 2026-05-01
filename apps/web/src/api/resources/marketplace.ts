import type { UseMutationResult } from '@tanstack/react-query';

import { type MarketplaceListing, marketplaceListingSchema } from '@loomlabs/schema';

import { type ApiClient, apiClient } from '../client';
import type { ApiError } from '../errors';
import { type MutationOpts, type ResourceHooks, makeResourceHooks } from '../hooks';
import { type ListParams, Resource } from '../resource';

export type { MarketplaceListing };

export interface MarketplaceListParams extends ListParams {
  protocol?: string;
  tag?: string;
  author?: string;
  workflowId?: string;
  sort?: 'newest' | 'popular';
  limit?: number;
  cursor?: string;
}

export interface PublishListingInput extends Record<string, unknown> {
  workflowId: string;
  author: string;
  tags?: string[];
  pricing?: { type: 'free' } | { type: 'x402'; amount: string; token: string };
  onchain?: {
    txHash: string;
    contentHash: string;
    uri: string;
    status?: 'pending' | 'confirmed';
  };
}

export interface ConfirmListingInput extends Record<string, unknown> {
  registryListingId?: number;
  confirmedAt?: number;
}

class MarketplaceResource extends Resource<MarketplaceListing, MarketplaceListParams> {
  constructor(client: ApiClient, path = '/marketplace') {
    super(client, path, { list: 'items', item: 'listing' }, marketplaceListingSchema);
  }
}

export const marketplaceResource = new MarketplaceResource(apiClient);

const baseHooks = makeResourceHooks<MarketplaceListing, MarketplaceListParams>(marketplaceResource);

const { keys: marketplaceKeys, useList, useOne, useCreate, useRemove, useInvalidate } = baseHooks;
const { useUpdate } = baseHooks;

export { marketplaceKeys };
export const useMarketplaceList: ResourceHooks<
  MarketplaceListing,
  MarketplaceListParams
>['useList'] = useList;
export const useMarketplaceListing: ResourceHooks<
  MarketplaceListing,
  MarketplaceListParams
>['useOne'] = useOne;
export const useUnpublishListing: ResourceHooks<
  MarketplaceListing,
  MarketplaceListParams
>['useRemove'] = useRemove;
export const useInvalidateMarketplace: ResourceHooks<
  MarketplaceListing,
  MarketplaceListParams
>['useInvalidate'] = useInvalidate;

export function usePublishToMarketplace(
  options?: MutationOpts<MarketplaceListing, PublishListingInput>,
): UseMutationResult<MarketplaceListing, ApiError, PublishListingInput> {
  return useCreate<PublishListingInput>(options);
}

export function useConfirmMarketplaceListing(
  options?: MutationOpts<MarketplaceListing, { id: string; body: ConfirmListingInput }>,
): UseMutationResult<MarketplaceListing, ApiError, { id: string; body: ConfirmListingInput }> {
  return useUpdate<ConfirmListingInput>(options);
}
