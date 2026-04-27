import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';

import { type ApiClient, apiClient } from '../client';
import type { ApiError } from '../errors';
import { type MutationOpts, type ResourceHooks, makeResourceHooks } from '../hooks';
import { Resource } from '../resource';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'deployed' | 'paused' | 'completed' | 'error';
  templateId: string;
  chainId: number;
  parameters: Record<string, unknown>;
  createdAt: number;
}

export interface WorkflowListParams extends Record<string, string | number | boolean | undefined> {
  status?: Workflow['status'];
  owner?: string;
  limit?: number;
}

/**
 * Domain extension of `Resource<Workflow>`.
 *
 * Adds workflow-specific operations on top of the standard CRUD methods.
 * Other resources follow the same pattern - extend Resource, expose typed
 * methods, and let `makeResourceHooks(...)` produce the generic hooks.
 */
export class WorkflowsResource extends Resource<Workflow, WorkflowListParams> {
  /** Trigger an immediate run of a deployed workflow. */
  run(id: string): Promise<{ ok: true; runId: string }> {
    return this.client.post<{ ok: true; runId: string }>(
      `${this.path}/${encodeURIComponent(id)}/run`,
    );
  }

  /** Pause a deployed workflow without removing it. */
  pause(id: string): Promise<Workflow> {
    return this.client.post<Workflow>(`${this.path}/${encodeURIComponent(id)}/pause`);
  }

  /** Resume a previously paused workflow. */
  resume(id: string): Promise<Workflow> {
    return this.client.post<Workflow>(`${this.path}/${encodeURIComponent(id)}/resume`);
  }

  /** Fork a workflow into the caller's account. */
  fork(id: string): Promise<Workflow> {
    return this.client.post<Workflow>(`${this.path}/${encodeURIComponent(id)}/fork`);
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

/** Trigger an immediate run. Invalidates the detail query on success. */
export function useRunWorkflow(
  options?: MutationOpts<{ ok: true; runId: string }, string>,
): UseMutationResult<{ ok: true; runId: string }, ApiError, string> {
  const qc = useQueryClient();
  return useMutation<{ ok: true; runId: string }, ApiError, string>({
    ...options,
    mutationFn: (id) => workflowsResource.run(id),
    onSuccess: (...args) => {
      const [, id] = args;
      qc.invalidateQueries({ queryKey: workflowKeys.detail(id) });
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

/**
 * Factory for tests / impersonation: bind the resource to a custom client
 * and re-derive the hooks. Most callers do not need this.
 */
export function workflowsHooksFor(client: ApiClient): ResourceHooks<Workflow, WorkflowListParams> {
  const r = new WorkflowsResource(client, '/workflows');
  return makeResourceHooks<Workflow, WorkflowListParams>(r);
}
