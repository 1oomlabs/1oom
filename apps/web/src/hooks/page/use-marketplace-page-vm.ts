import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import { z } from 'zod';

import { type MarketplaceListing, useMarketplaceList } from '@/api';
import type { ApiError } from '@/api';
import { protocolFromTemplateId } from '@/lib/view-models';

export const protocols = ['all', 'aave', 'uniswap', 'lido', 'custom'] as const;
export type ProtocolFilter = (typeof protocols)[number];

export const sorts = [
  { value: 'popular', label: 'Most installed' },
  { value: 'newest', label: 'Newest' },
] as const;
export type SortValue = (typeof sorts)[number]['value'];

/**
 * URL search params for /marketplace. `.catch()` keeps the page resilient
 * to handcrafted/legacy URLs by falling back to defaults instead of crashing.
 */
export const marketplaceSearchSchema = z.object({
  filter: z.enum(protocols).catch('all').default('all'),
  query: z.string().catch('').default(''),
  sort: z.enum(['popular', 'newest']).catch('popular').default('popular'),
});

export type MarketplaceSearch = z.infer<typeof marketplaceSearchSchema>;

export interface MarketplacePageVM {
  filter: ProtocolFilter;
  setFilter: (f: ProtocolFilter) => void;
  query: string;
  setQuery: (q: string) => void;
  sort: SortValue;
  setSort: (s: SortValue) => void;
  isLoading: boolean;
  isError: boolean;
  error: ApiError | null;
  refetch: () => void;
  results: MarketplaceListing[];
  totalCount: number;
}

export function useMarketplacePageVM(): MarketplacePageVM {
  const search = useSearch({ from: '/marketplace' });
  const navigate = useNavigate({ from: '/marketplace' });

  const updateSearch = (patch: Partial<MarketplaceSearch>) => {
    void navigate({
      search: (prev: MarketplaceSearch) => ({ ...prev, ...patch }),
      replace: true,
    });
  };

  const { filter, query, sort } = search;

  const { data: listings, isLoading, isError, error, refetch } = useMarketplaceList({ sort });

  const results: MarketplaceListing[] = useMemo(() => {
    const items = listings ?? [];
    return items.filter((l) => {
      if (filter !== 'all' && protocolFromTemplateId(l.workflow.templateId) !== filter) {
        return false;
      }
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        l.workflow.name.toLowerCase().includes(q) ||
        (l.workflow.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [listings, filter, query]);

  return {
    filter,
    setFilter: (f) => updateSearch({ filter: f }),
    query,
    setQuery: (q) => updateSearch({ query: q }),
    sort,
    setSort: (s) => updateSearch({ sort: s }),
    isLoading,
    isError,
    error: error ?? null,
    refetch: () => {
      void refetch();
    },
    results,
    totalCount: results.length,
  };
}
