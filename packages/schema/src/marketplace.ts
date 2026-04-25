import { z } from 'zod';
import { workflowSchema } from './workflow';

/**
 * A workflow published to the marketplace so other agents/users can discover
 * and consume it.
 */
export const marketplaceListingSchema = z.object({
  id: z.string(),
  workflow: workflowSchema,
  author: z.string(),
  tags: z.array(z.string()).default([]),
  pricing: z.discriminatedUnion('type', [
    z.object({ type: z.literal('free') }),
    z.object({
      type: z.literal('x402'),
      amount: z.string(),
      token: z.string(),
    }),
  ]),
  stats: z
    .object({
      installs: z.number().int().default(0),
      runs: z.number().int().default(0),
    })
    .default({ installs: 0, runs: 0 }),
  createdAt: z.number().int(),
});
export type MarketplaceListing = z.infer<typeof marketplaceListingSchema>;

/**
 * Query params when browsing / filtering the marketplace.
 */
export const marketplaceQuerySchema = z.object({
  protocol: z.string().optional(),
  tag: z.string().optional(),
  author: z.string().optional(),
  sort: z.enum(['newest', 'popular']).default('newest'),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type MarketplaceQuery = z.infer<typeof marketplaceQuerySchema>;
