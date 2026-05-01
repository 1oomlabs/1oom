import { z } from 'zod';
import { actionSchema, triggerSchema } from './template';

/**
 * A concrete workflow: a template with all parameters resolved,
 * ready to be deployed to KeeperHub.
 */
export const workflowSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  owner: z.string().describe('EOA address of the creator'),
  name: z.string(),
  description: z.string().optional(),
  chainId: z.number().int().positive(),
  parameters: z.record(z.string(), z.unknown()),
  trigger: triggerSchema,
  actions: z.array(actionSchema),
  createdAt: z.number().int(),
  status: z.enum(['draft', 'deployed', 'paused', 'completed', 'error']).default('draft'),
  keeperJobId: z.string().optional(),
  runCount: z.number().int().nonnegative().default(0),
  lastRunAt: z.number().int().optional(),
});
export type Workflow = z.infer<typeof workflowSchema>;

export const executionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  executionId: z.string(),
  status: z.string(),
  createdAt: z.number().int(),
});
export type Execution = z.infer<typeof executionSchema>;

export const workflowStatusSchema = z.object({
  jobId: z.string(),
  status: z.string(),
});
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

/**
 * Request payload when an agent/user submits natural language to create a workflow.
 */
export const createWorkflowRequestSchema = z.object({
  prompt: z.string().min(1),
  owner: z.string(),
  chainId: z.number().int().positive(),
});
export type CreateWorkflowRequest = z.infer<typeof createWorkflowRequestSchema>;
