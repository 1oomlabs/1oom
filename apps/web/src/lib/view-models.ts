import type { MarketplaceListing, Workflow } from '@loomlabs/schema';

import type { WorkflowCardData } from '@/components/ui/workflow-card';

/**
 * Map a template id to the protocol bucket the UI displays.
 * Templates follow `<protocol>-<...>` naming.
 */
export function protocolFromTemplateId(templateId: string): WorkflowCardData['protocol'] {
  const head = templateId.split('-')[0];
  if (head === 'aave' || head === 'uniswap' || head === 'lido') return head;
  return 'custom';
}

/**
 * Adapt a marketplace listing to the card view model. Listings have stats
 * and pricing that bare workflows do not.
 */
export function listingToCard(listing: MarketplaceListing): WorkflowCardData {
  const w = listing.workflow;
  return {
    id: w.id,
    name: w.name,
    description: w.description ?? '',
    protocol: protocolFromTemplateId(w.templateId),
    author: listing.author,
    price:
      listing.pricing.type === 'free'
        ? 'free'
        : { amount: listing.pricing.amount, token: listing.pricing.token },
    installs: listing.stats.installs,
    runs: listing.stats.runs,
  };
}

/**
 * Adapt a bare workflow (no listing context) to the card view model.
 * Used on the agent profile and on the home featured grid before any listings exist.
 * Stats default to zero since they only exist on listings.
 */
export function workflowToCard(w: Workflow): WorkflowCardData {
  return {
    id: w.id,
    name: w.name,
    description: w.description ?? '',
    protocol: protocolFromTemplateId(w.templateId),
    author: w.owner,
    installs: 0,
    runs: 0,
  };
}
