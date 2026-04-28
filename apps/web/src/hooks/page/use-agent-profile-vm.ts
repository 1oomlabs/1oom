import { useParams } from '@tanstack/react-router';

import { type Agent, type MarketplaceListing, useAgent, useMarketplaceList } from '@/api';

export interface AgentProfileStats {
  totalListings: number;
  totalRuns: number;
  totalInstalls: number;
}

export interface AgentProfileVM {
  id: string;
  isLoading: boolean;
  isError: boolean;
  agent: Agent | undefined;
  listings: MarketplaceListing[];
  loadingListings: boolean;
  stats: AgentProfileStats;
}

export function useAgentProfileVM(): AgentProfileVM {
  const { id } = useParams({ from: '/agents/$id' });
  const { data: agent, isLoading, isError } = useAgent(id);
  const { data: listings, isLoading: loadingListings } = useMarketplaceList();

  const safeListings = listings ?? [];
  const stats: AgentProfileStats = {
    totalListings: safeListings.length,
    totalRuns: safeListings.reduce((sum, l) => sum + l.stats.runs, 0),
    totalInstalls: safeListings.reduce((sum, l) => sum + l.stats.installs, 0),
  };

  return {
    id,
    isLoading,
    isError,
    agent,
    listings: safeListings,
    loadingListings,
    stats,
  };
}
