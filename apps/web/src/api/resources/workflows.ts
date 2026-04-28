import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreateWorkflowRequest, Workflow } from '@loomlabs/schema';

import { type ApiClient, apiClient } from '../client';
import type { ApiError } from '../errors';
import { type MutationOpts, type ResourceHooks, makeResourceHooks } from '../hooks';
import { Resource } from '../resource';

export type { Workflow, CreateWorkflowRequest };

export interface WorkflowListParams extends Record<string, string | number | boolean | undefined> {
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

/**
 * Domain extension of `Resource<Workflow>`.
 *
 * Backend wraps responses in envelopes ({workflow}/{workflows}), so all CRUD
 * methods are overridden to unwrap. Custom mutations (run/pause/resume/fork)
 * follow the same pattern.
 */
export class WorkflowsResource extends Resource<Workflow, WorkflowListParams> {
  override async list(params?: WorkflowListParams): Promise<Workflow[]> {
    const res = await this.client.get<{ workflows: Workflow[] }>(this.path, { query: params });
    return res.workflows;
  }

  override async get(id: string): Promise<Workflow> {
    const res = await this.client.get<{ workflow: Workflow }>(
      `${this.path}/${encodeURIComponent(id)}`,
    );
    return res.workflow;
  }

  /**
   * The create endpoint compiles natural language into a workflow in one shot.
   * Body must match `CreateWorkflowRequest` ({ prompt, owner, chainId }).
   */
  override async create(body: CreateWorkflowRequest | Record<string, unknown>): Promise<Workflow> {
    const res = await this.client.post<{ workflow: Workflow; intent: Intent }>(this.path, body);
    return res.workflow;
  }

  override async remove(id: string): Promise<void> {
    await this.client.delete<{ deleted: true }>(`${this.path}/${encodeURIComponent(id)}`);
  }

  /** Trigger an immediate run of a deployed workflow. */
  async run(id: string): Promise<{ workflow: Workflow; execution: ExecuteResult }> {
    return this.client.post<{ workflow: Workflow; execution: ExecuteResult }>(
      `${this.path}/${encodeURIComponent(id)}/run`,
    );
  }

  /** Pause a deployed workflow without removing it. */
  async pause(id: string): Promise<Workflow> {
    const res = await this.client.post<{ workflow: Workflow }>(
      `${this.path}/${encodeURIComponent(id)}/pause`,
    );
    return res.workflow;
  }

  /** Resume a previously paused workflow. */
  async resume(id: string): Promise<Workflow> {
    const res = await this.client.post<{ workflow: Workflow }>(
      `${this.path}/${encodeURIComponent(id)}/resume`,
    );
    return res.workflow;
  }

  /** Fork a workflow into the caller's account. */
  async fork(id: string): Promise<Workflow> {
    const res = await this.client.post<{ workflow: Workflow; forkedFrom: string }>(
      `${this.path}/${encodeURIComponent(id)}/fork`,
    );
    return res.workflow;
  }
}

export const workflowsResource = new WorkflowsResource(apiClient, '/workflows');

/** Standard CRUD hooks generated from the resource. */
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

// ─────────── custom mutations ───────────

export function useRunWorkflow(
  options?: MutationOpts<{ workflow: Workflow; execution: ExecuteResult }, string>,
): UseMutationResult<{ workflow: Workflow; execution: ExecuteResult }, ApiError, string> {
  const qc = useQueryClient();
  return useMutation<{ workflow: Workflow; execution: ExecuteResult }, ApiError, string>({
    ...options,
    mutationFn: (id) => workflowsResource.run(id),
    onSuccess: (...args) => {
      const [, id] = args;
      qc.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      qc.invalidateQueries({ queryKey: workflowKeys.all() });
      return options?.onSuccess?.(...args);
    },
  });
}

export function usePauseWorkflow(
  options?: MutationOpts<Workflow, string>,
): UseMutationResult<Workflow, ApiError, string> {
  const qc = useQueryClient();
  return useMutation<Workflow, ApiError, string>({
    ...options,
    mutationFn: (id) => workflowsResource.pause(id),
    onSuccess: (...args) => {
      const [, id] = args;
      qc.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      qc.invalidateQueries({ queryKey: workflowKeys.all() });
      return options?.onSuccess?.(...args);
    },
  });
}

export function useResumeWorkflow(
  options?: MutationOpts<Workflow, string>,
): UseMutationResult<Workflow, ApiError, string> {
  const qc = useQueryClient();
  return useMutation<Workflow, ApiError, string>({
    ...options,
    mutationFn: (id) => workflowsResource.resume(id),
    onSuccess: (...args) => {
      const [, id] = args;
      qc.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      qc.invalidateQueries({ queryKey: workflowKeys.all() });
      return options?.onSuccess?.(...args);
    },
  });
}

export function useForkWorkflow(
  options?: MutationOpts<Workflow, string>,
): UseMutationResult<Workflow, ApiError, string> {
  const qc = useQueryClient();
  return useMutation<Workflow, ApiError, string>({
    ...options,
    mutationFn: (id) => workflowsResource.fork(id),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: workflowKeys.all() });
      return options?.onSuccess?.(...args);
    },
  });
}

export function workflowsHooksFor(client: ApiClient): ResourceHooks<Workflow, WorkflowListParams> {
  const r = new WorkflowsResource(client, '/workflows');
  return makeResourceHooks<Workflow, WorkflowListParams>(r);
}
