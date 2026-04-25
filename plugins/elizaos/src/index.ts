import { extractWorkflowIntent } from '@loomlabs/llm';

/**
 * ElizaOS plugin surface.
 *
 * Exposes two primary actions to agents:
 *   1. CREATE_WORKFLOW - turn a natural-language prompt into a workflow and deploy it.
 *   2. BROWSE_MARKETPLACE - discover and consume workflows published by other agents.
 *
 * Types are kept loose so this package does not hard-depend on @elizaos/core.
 * When wired to a real ElizaOS runtime, these shapes are satisfied by the runtime's
 * action interface.
 */

type ActionHandler = (runtime: unknown, message: { text: string }) => Promise<unknown>;

export interface LoomAction {
  name: string;
  description: string;
  handler: ActionHandler;
}

export const createWorkflowAction: LoomAction = {
  name: 'CREATE_WORKFLOW',
  description: 'Create a DeFi automation workflow from a natural-language description.',
  handler: async (_runtime, message) => {
    const intent = await extractWorkflowIntent({ prompt: message.text });
    return {
      ok: true,
      intent,
      // TODO(roleset-2): POST to apps/api /api/workflows to actually deploy.
    };
  },
};

export const browseMarketplaceAction: LoomAction = {
  name: 'BROWSE_MARKETPLACE',
  description: 'List workflow listings on the loomlabs marketplace.',
  handler: async () => {
    // TODO(roleset-2): GET apps/api /api/marketplace and return top matches.
    return { items: [] };
  },
};

export const loomPlugin = {
  name: 'loomlabs',
  description: 'Natural-language DeFi workflow creation and marketplace, via KeeperHub.',
  actions: [createWorkflowAction, browseMarketplaceAction],
};

export default loomPlugin;
