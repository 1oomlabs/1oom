import type { UseMutationResult } from '@tanstack/react-query';

import type { CreateWorkflowRequest, Workflow } from '@loomlabs/schema';

import { type ApiClient, apiClient } from '../client';
import type { ApiError } from '../errors';
import {
  type MutationOpts,
  type ResourceHooks,
  makeResourceHooks,
  useResourceMutation,
} from '../hooks';
import { type ListParams, Resource } from '../resource';

export type { Workflow, CreateWorkflowRequest };

export interface WorkflowListParams extends ListParams {
  status?: Workflow['status'];
  owner?: string;
  limit?: number;
}

export interface Intent {
  templateId: string;
  confidence: number;
  parameters: Record<string, unknown>;
  reasoning?: string;
}

export interface ExecuteResult {
  executionId: string;
  status: string;
}

export class WorkflowsResource extends Resource<Workflow, WorkflowListParams> {
  constructor(client: ApiClient, path = '/workflows') {
    super(client, path, { list: 'workflows', item: 'workflow' });
  }

  async run(id: string): Promise<{ workflow: Workflow; execution: ExecuteResult }> {
    return this.client.post<{ workflow: Workflow; execution: ExecuteResult }>(
      `${this.path}/${encodeURIComponent(id)}/run`,
    );
  }

  async pause(id: string): Promise<Workflow> {
    const res = await this.client.post<{ workflow: Workflow }>(
      `${this.path}/${encodeURIComponent(id)}/pause`,
    );
    return res.workflow;
  }

  async resume(id: string): Promise<Workflow> {
    const res = await this.client.post<{ workflow: Workflow }>(
      `${this.path}/${encodeURIComponent(id)}/resume`,
    );
    return res.workflow;
  }

  async fork(id: string): Promise<Workflow> {
    const res = await this.client.post<{ workflow: Workflow; forkedFrom: string }>(
      `${this.path}/${encodeURIComponent(id)}/fork`,
    );
    return res.workflow;
  }
}

export const workflowsResource = new WorkflowsResource(apiClient);

const baseHooks = makeResourceHooks<Workflow, WorkflowListParams>(workflowsResource);

const {
  keys: workflowKeys,
  useList,
  useOne,
  useCreate,
  useUpdate,
  useRemove,
  useInvalidate,
} = baseHooks;

export { workflowKeys };
export const useWorkflowsList: ResourceHooks<Workflow, WorkflowListParams>['useList'] = useList;
export const useWorkflow: ResourceHooks<Workflow, WorkflowListParams>['useOne'] = useOne;
export const useCreateWorkflow: ResourceHooks<Workflow, WorkflowListParams>['useCreate'] =
  useCreate;
export const useUpdateWorkflow: ResourceHooks<Workflow, WorkflowListParams>['useUpdate'] =
  useUpdate;
export const useDeleteWorkflow: ResourceHooks<Workflow, WorkflowListParams>['useRemove'] =
  useRemove;
export const useInvalidateWorkflows: ResourceHooks<Workflow, WorkflowListParams>['useInvalidate'] =
  useInvalidate;

export function useRunWorkflow(
  options?: MutationOpts<{ workflow: Workflow; execution: ExecuteResult }, string>,
): UseMutationResult<{ workflow: Workflow; execution: ExecuteResult }, ApiError, string> {
  return useResourceMutation({
    mutationFn: (id) => workflowsResource.run(id),
    invalidate: (_data, id) => [workflowKeys.detail(id), workflowKeys.all()],
    options,
  });
}

export function usePauseWorkflow(
  options?: MutationOpts<Workflow, string>,
): UseMutationResult<Workflow, ApiError, string> {
  return useResourceMutation({
    mutationFn: (id) => workflowsResource.pause(id),
    invalidate: (_data, id) => [workflowKeys.detail(id), workflowKeys.all()],
    options,
  });
}

export function useResumeWorkflow(
  options?: MutationOpts<Workflow, string>,
): UseMutationResult<Workflow, ApiError, string> {
  return useResourceMutation({
    mutationFn: (id) => workflowsResource.resume(id),
    invalidate: (_data, id) => [workflowKeys.detail(id), workflowKeys.all()],
    options,
  });
}

export function useForkWorkflow(
  options?: MutationOpts<Workflow, string>,
): UseMutationResult<Workflow, ApiError, string> {
  return useResourceMutation({
    mutationFn: (id) => workflowsResource.fork(id),
    invalidate: () => [workflowKeys.all()],
    options,
  });
}

export function workflowsHooksFor(client: ApiClient): ResourceHooks<Workflow, WorkflowListParams> {
  const r = new WorkflowsResource(client);
  return makeResourceHooks<Workflow, WorkflowListParams>(r);
}
