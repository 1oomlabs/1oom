import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query';

import { apiClient } from '../client';
import type { ApiError } from '../errors';
import type { MutationOpts, QueryOpts } from '../hooks';
import { makeQueryKeys } from '../keys';
import type { Intent } from './workflows';

export interface Agent {
  id: string;
  name: string;
  description: string;
  actions: string[];
}

const path = '/agents';
const agentKeys = makeQueryKeys(path);
export { agentKeys };

export function useAgentsList(options?: QueryOpts<Agent[]>): UseQueryResult<Agent[], ApiError> {
  return useQuery<Agent[], ApiError>({
    ...options,
    queryKey: agentKeys.list(),
    queryFn: async () => {
      const res = await apiClient.get<{ agents: Agent[] }>(path);
      return res.agents;
    },
  });
}

export function useAgent(
  id: string | undefined,
  options?: QueryOpts<Agent>,
): UseQueryResult<Agent, ApiError> {
  return useQuery<Agent, ApiError>({
    ...options,
    queryKey: agentKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.get<{ agent: Agent }>(`${path}/${encodeURIComponent(id!)}`);
      return res.agent;
    },
    enabled: Boolean(id) && options?.enabled !== false,
  });
}

export interface AgentIntentResult {
  agent: string;
  message: string;
  intent: Intent;
}

export function useAgentIntent(
  agentId: string,
  options?: MutationOpts<AgentIntentResult, { message: string }>,
): UseMutationResult<AgentIntentResult, ApiError, { message: string }> {
  return useMutation<AgentIntentResult, ApiError, { message: string }>({
    ...options,
    mutationFn: ({ message }) =>
      apiClient.post<AgentIntentResult>(`${path}/${encodeURIComponent(agentId)}/intent`, {
        message,
      }),
  });
}
