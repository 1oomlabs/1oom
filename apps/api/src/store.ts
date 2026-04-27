import { randomUUID } from 'node:crypto';
import type { Workflow } from '@loomlabs/schema';

const workflows = new Map<string, Workflow>();

type CreateWorkflowInput = Omit<Workflow, 'id' | 'createdAt' | 'status'> & {
  status?: Workflow['status'];
};

export const workflowStore = {
  create(input: CreateWorkflowInput): Workflow {
    const workflow: Workflow = {
      ...input,
      id: randomUUID(),
      createdAt: Date.now(),
      status: input.status ?? 'draft',
    };
    workflows.set(workflow.id, workflow);
    return workflow;
  },

  get(id: string): Workflow | undefined {
    return workflows.get(id);
  },

  list(): Workflow[] {
    return Array.from(workflows.values());
  },

  update(id: string, patch: Partial<Workflow>): Workflow | undefined {
    const existing = workflows.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id: existing.id };
    workflows.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return workflows.delete(id);
  },
};
