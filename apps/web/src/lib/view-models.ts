import type { MarketplaceListing, Workflow } from '@loomlabs/schema';

import type { WorkflowCardData } from '@/components/ui/workflow-card';
import { explorerTxUrl } from '@/lib/constants';

export function protocolFromTemplateId(templateId: string): WorkflowCardData['protocol'] {
  const head = templateId.split('-')[0];
  if (head === 'aave' || head === 'uniswap' || head === 'lido') return head;
  return 'custom';
}

export function listingToCard(listing: MarketplaceListing): WorkflowCardData {
  const w = listing.workflow;
  const onchain = listing.stats.onchain;
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
    verified: onchain
      ? {
          status: onchain.status,
          txHash: onchain.txHash,
          explorerUrl: explorerTxUrl(onchain.txHash, w.chainId),
        }
      : undefined,
  };
}

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
