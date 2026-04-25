import { z } from 'zod';

/**
 * Protocol a template targets.
 */
export const protocolSchema = z.enum(['aave', 'uniswap', 'lido', 'custom']);
export type Protocol = z.infer<typeof protocolSchema>;

/**
 * Trigger types supported by KeeperHub.
 */
export const triggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cron'), expression: z.string() }),
  z.object({ type: z.literal('onchain'), eventSignature: z.string() }),
  z.object({
    type: z.literal('price'),
    token: z.string(),
    operator: z.enum(['gt', 'lt']),
    value: z.string(),
  }),
]);
export type Trigger = z.infer<typeof triggerSchema>;

/**
 * Parameter definition for a template (what the user/agent must fill in).
 */
export const parameterTypeSchema = z.enum([
  'address',
  'uint256',
  'string',
  'duration',
  'number',
  'boolean',
]);
export type ParameterType = z.infer<typeof parameterTypeSchema>;

export const templateParameterSchema = z.object({
  name: z.string(),
  type: parameterTypeSchema,
  required: z.boolean().default(false),
  description: z.string(),
  default: z.unknown().optional(),
});
export type TemplateParameter = z.infer<typeof templateParameterSchema>;

/**
 * A single contract call step.
 */
export const actionSchema = z.object({
  contract: z.string(),
  method: z.string(),
  args: z.array(z.string()),
});
export type Action = z.infer<typeof actionSchema>;

/**
 * Full template: a parameterised automation blueprint.
 */
export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  protocol: protocolSchema,
  category: z.string(),
  description: z.string(),
  intentKeywords: z.array(z.string()),
  parameters: z.array(templateParameterSchema),
  trigger: triggerSchema,
  actions: z.array(actionSchema),
});
export type Template = z.infer<typeof templateSchema>;
