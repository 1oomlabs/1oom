import { useMemo, useState } from 'react';

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
  const [filter, setFilter] = useState<ProtocolFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortValue>('popular');

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
    setFilter,
    query,
    setQuery,
    sort,
    setSort,
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
