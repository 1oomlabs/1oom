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

export const agentTag = (id: string): string => `agent:${id}`;

export function useAgentProfileVM(): AgentProfileVM {
  const { id } = useParams({ from: '/agents/$id' });
  const { data: agent, isLoading, isError } = useAgent(id);
  const { data: marketListings, isLoading: loadingListings } = useMarketplaceList();

  const tag = agentTag(id);
  const listings = (marketListings ?? []).filter((l) => l.tags.includes(tag));

  const stats: AgentProfileStats = {
    totalListings: listings.length,
    totalRuns: listings.reduce((sum, l) => sum + l.stats.runs, 0),
    totalInstalls: listings.reduce((sum, l) => sum + l.stats.installs, 0),
  };

  return {
    id,
    isLoading,
    isError,
    agent,
    listings,
    loadingListings,
    stats,
  };
}
