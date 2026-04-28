import { useNavigate } from '@tanstack/react-router';

import { type MarketplaceListing, useMarketplaceList } from '@/api';
import { useDraftStore } from '@/store/draft-store';

export const promptExamples = [
  'Every Friday, deposit 100 USDC into Aave',
  'Buy 0.05 ETH each Monday with USDC on Uniswap',
  'Stake 1 ETH into Lido and compound stETH monthly',
];

interface StatTile {
  label: string;
  value: string;
}

export interface HomePageVM {
  isLoading: boolean;
  listings: MarketplaceListing[];
  featured: MarketplaceListing[];
  stats: StatTile[];
  onPromptSubmit: (value: string) => void;
}

export function useHomePageVM(): HomePageVM {
  const navigate = useNavigate();
  const setPrompt = useDraftStore((s) => s.setPrompt);

  const { data: listings, isLoading } = useMarketplaceList(
    { sort: 'popular', limit: 6 },
    { staleTime: 30_000 },
  );

  const safeListings = listings ?? [];
  const featured = safeListings.slice(0, 6);

  const totalRuns = featured.reduce((sum, l) => sum + l.stats.runs, 0);
  const totalInstalls = featured.reduce((sum, l) => sum + l.stats.installs, 0);

  const stats: StatTile[] = [
    { label: 'Workflows', value: String(safeListings.length) },
    { label: 'Featured', value: String(featured.length) },
    { label: 'Total runs', value: totalRuns.toLocaleString() },
    { label: 'Total installs', value: totalInstalls.toLocaleString() },
  ];

  const onPromptSubmit = (value: string) => {
    setPrompt(value);
    navigate({ to: '/workflows/new' });
  };

  return { isLoading, listings: safeListings, featured, stats, onPromptSubmit };
}
