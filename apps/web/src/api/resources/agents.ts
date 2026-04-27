import { apiClient } from '../client';
import { type ResourceHooks, makeResourceHooks } from '../hooks';
import { Resource } from '../resource';

export interface Agent {
  id: string;
  name: string;
  handle: string;
  bio?: string;
  address: string;
  joined: string;
  stats: {
    published: number;
    installs: number;
    runs: number;
  };
}

export interface AgentListParams extends Record<string, string | number | boolean | undefined> {
  q?: string;
  sort?: 'newest' | 'popular';
}

// No agent-specific actions yet - use the base Resource directly.
// Promote to a subclass when first custom mutation is needed.
export const agentsResource = new Resource<Agent, AgentListParams>(apiClient, '/agents');

const baseHooks = makeResourceHooks<Agent, AgentListParams>(agentsResource);

const { keys: agentKeys, useList, useOne, useInvalidate } = baseHooks;

export { agentKeys };
export const useAgentsList: ResourceHooks<Agent, AgentListParams>['useList'] = useList;
export const useAgent: ResourceHooks<Agent, AgentListParams>['useOne'] = useOne;
export const useInvalidateAgents: ResourceHooks<Agent, AgentListParams>['useInvalidate'] =
  useInvalidate;
