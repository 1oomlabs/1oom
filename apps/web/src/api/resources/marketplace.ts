import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';

import type { MarketplaceListing } from '@loomlabs/schema';

import { apiClient } from '../client';
import type { ApiError } from '../errors';
import { type MutationOpts, type ResourceHooks, makeResourceHooks } from '../hooks';
import { Resource } from '../resource';

export type { MarketplaceListing };

export interface MarketplaceListParams
  extends Record<string, string | number | boolean | undefined> {
  protocol?: string;
  tag?: string;
  author?: string;
  sort?: 'newest' | 'popular';
  limit?: number;
  cursor?: string;
}

export interface PublishListingInput extends Record<string, unknown> {
  workflowId: string;
  author: string;
  tags?: string[];
  pricing?: { type: 'free' } | { type: 'x402'; amount: string; token: string };
}

class MarketplaceResource extends Resource<MarketplaceListing, MarketplaceListParams> {
  override async list(params?: MarketplaceListParams): Promise<MarketplaceListing[]> {
    const res = await this.client.get<{ items: MarketplaceListing[]; total: number }>(this.path, {
      query: params,
    });
    return res.items;
  }

  override async get(id: string): Promise<MarketplaceListing> {
    const res = await this.client.get<{ listing: MarketplaceListing }>(
      `${this.path}/${encodeURIComponent(id)}`,
    );
    return res.listing;
  }

  override async create(
    body: PublishListingInput | Record<string, unknown>,
  ): Promise<MarketplaceListing> {
    const res = await this.client.post<{ listing: MarketplaceListing }>(this.path, body);
    return res.listing;
  }

  override async remove(id: string): Promise<void> {
    await this.client.delete<{ deleted: true }>(`${this.path}/${encodeURIComponent(id)}`);
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
export const useUnpublishListing: ResourceHooks<
  MarketplaceListing,
  MarketplaceListParams
>['useRemove'] = useRemove;
export const useInvalidateMarketplace: ResourceHooks<
  MarketplaceListing,
  MarketplaceListParams
>['useInvalidate'] = useInvalidate;

/**
 * Publish a workflow to the marketplace. Body shape is `PublishListingInput`,
 * not the listing itself — the backend snapshots the workflow into the listing.
 */
export function usePublishToMarketplace(
  options?: MutationOpts<MarketplaceListing, PublishListingInput>,
): UseMutationResult<MarketplaceListing, ApiError, PublishListingInput> {
  return useCreate<PublishListingInput>(options);
}
