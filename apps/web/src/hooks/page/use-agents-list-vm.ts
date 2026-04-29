import { type Agent, type ApiError, useAgentsList } from '@/api';

export interface AgentsListVM {
  agents: Agent[];
  isLoading: boolean;
  isError: boolean;
  error: ApiError | null;
  refetch: () => void;
}

export function useAgentsListVM(): AgentsListVM {
  const { data, isLoading, isError, error, refetch } = useAgentsList();

  return {
    agents: data ?? [],
    isLoading,
    isError,
    error: error ?? null,
    refetch: () => {
      void refetch();
    },
  };
}
