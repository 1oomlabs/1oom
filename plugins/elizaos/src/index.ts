import {
  DRY_RUN_ONLY,
  findTemplatesByKeyword,
  getSepoliaTemplateMetadata,
  templates,
} from '@loomlabs/templates';

/**
 * ElizaOS plugin surface.
 *
 * Exposes demo-safe actions to agents:
 *   1. CREATE_WORKFLOW - turn a natural-language prompt into a dry-run workflow candidate.
 *   2. BROWSE_MARKETPLACE - discover marketplace entries without network calls.
 *   3. BROWSE_TEMPLATES - list local templates and Sepolia metadata status.
 *   4. DESCRIBE_TEMPLATE - describe one local template and its Sepolia demo metadata.
 *   5. CREATE_WORKFLOW_DEMO - create a dry-run demo workflow candidate only.
 *
 * Types are kept loose so this package does not hard-depend on @elizaos/core.
 * Runtime compatibility remains INTEGRATION_RISK until verified against the actual runtime.
 */

export const INTEGRATION_RISK = 'INTEGRATION_RISK' as const;

type ActionHandler = (runtime: unknown, message: { text: string }) => Promise<unknown>;

export interface LoomAction {
  name: string;
  description: string;
  handler: ActionHandler;
}

export type LoomPlugin = {
  name: string;
  description: string;
  integrationRisk: typeof INTEGRATION_RISK;
  executionMode: typeof DRY_RUN_ONLY;
  safety: {
    forbiddenRuntimeRequirements: readonly string[];
    noProductionExecutionTerms: readonly string[];
  };
  actions: LoomAction[];
};

type DemoWorkflowCandidate = {
  ok: true;
  executionMode: typeof DRY_RUN_ONLY;
  integrationRisk: typeof INTEGRATION_RISK;
  safety: ReturnType<typeof dryRunSafetyPayload>;
  intent: unknown;
  templateCandidates: ReturnType<typeof summarizeTemplate>[];
  unsupportedOperations: string[];
};

type DemoIntent = {
  templateId: string;
  confidence: number;
  parameters: Record<string, unknown>;
  reasoning: string;
};

function extractTemplateId(message: { text: string }): string | undefined {
  const trimmed = message.text.trim();

  if (!trimmed) {
    return undefined;
  }

  const exactTemplate = templates.find((template) => template.id === trimmed);

  if (exactTemplate) {
    return exactTemplate.id;
  }

  const idMatch = trimmed.match(/template(?:Id)?\s*[:=]\s*([a-z0-9-]+)/i);
  return idMatch?.[1];
}

function summarizeTemplate(template: (typeof templates)[number]) {
  const metadata = getSepoliaTemplateMetadata(template.id);

  return {
    id: template.id,
    name: template.name,
    protocol: template.protocol,
    category: template.category,
    description: template.description,
    intentKeywords: template.intentKeywords,
    parameters: template.parameters,
    trigger: template.trigger,
    actions: template.actions.map((action) => ({
      contract: action.contract,
      method: action.method,
      args: action.args,
    })),
    sepolia: metadata
      ? {
          chainId: metadata.chainId,
          network: metadata.network,
          executionMode: metadata.executionMode,
          demoOnly: metadata.demoOnly,
          requiresHumanConfirmation: metadata.requiresHumanConfirmation,
          humanConfirmationStatus: metadata.requiresHumanConfirmation
            ? 'NEEDS_HUMAN_CONFIRMATION'
            : 'HUMAN_CONFIRMED',
          unresolvedHumanConfirmations: metadata.unresolvedHumanConfirmations,
          runtimePlaceholders: metadata.runtimePlaceholders,
          runtimePlaceholderValues: metadata.runtimePlaceholderValues,
          demoParameters: metadata.demoParameters,
          verificationTargets: metadata.verificationTargets,
          liquidity: metadata.liquidity,
          unsupportedOperations: metadata.unsupportedOperations,
        }
      : undefined,
  };
}

function findTemplateCandidates(prompt: string): ReturnType<typeof summarizeTemplate>[] {
  const promptLower = prompt.toLowerCase();
  const exactIdMatch = templates.find((template) =>
    promptLower.includes(template.id.toLowerCase()),
  );

  if (exactIdMatch) {
    return [summarizeTemplate(exactIdMatch)];
  }

  const keywordMatches = templates.filter((template) =>
    template.intentKeywords.some((keyword) => promptLower.includes(keyword.toLowerCase())),
  );

  if (keywordMatches.length > 0) {
    return keywordMatches.map(summarizeTemplate);
  }

  const firstToken = promptLower.split(/\s+/).find(Boolean);
  const fallbackMatches = firstToken ? findTemplatesByKeyword(firstToken) : [];

  return (fallbackMatches.length > 0 ? fallbackMatches : templates).map(summarizeTemplate);
}

function inferDemoIntent(
  prompt: string,
  candidates: ReturnType<typeof summarizeTemplate>[],
): DemoIntent {
  const fallbackTemplate = templates[0];

  if (!fallbackTemplate) {
    throw new Error('Template registry must expose at least one template.');
  }

  const primaryCandidate = candidates[0] ?? summarizeTemplate(fallbackTemplate);

  return {
    templateId: primaryCandidate.id,
    confidence: candidates.length === 1 ? 0.85 : 0.55,
    parameters: Object.fromEntries(
      primaryCandidate.parameters.map((parameter) => {
        const demoValue = primaryCandidate.sepolia?.demoParameters.find(
          (candidate) => candidate.name === parameter.name,
        )?.value;

        return [parameter.name, demoValue ?? parameter.default ?? null];
      }),
    ),
    reasoning: `Local dry-run heuristic selected ${primaryCandidate.id} for prompt: ${prompt}`,
  };
}

function demoUnsupportedOperations(candidates: ReturnType<typeof summarizeTemplate>[]): string[] {
  const operations = new Set<string>();

  for (const candidate of candidates) {
    for (const operation of candidate.sepolia?.unsupportedOperations ?? []) {
      operations.add(operation);
    }
  }

  operations.add('api-deploy');
  operations.add('keeperhub-deploy');

  return [...operations].sort();
}

function dryRunSafetyPayload() {
  return {
    canExecuteTransactions: false,
    requiresSigner: false,
    requiresRpc: false,
    requiresWallet: false,
    requiresPrivateKey: false,
    executionBlockedBy: [
      'dry-run-only',
      'no-signer',
      'no-rpc',
      'no-wallet',
      'no-transaction-broadcast',
    ],
  };
}

async function createDryRunWorkflowCandidate(message: {
  text: string;
}): Promise<DemoWorkflowCandidate> {
  const templateCandidates = findTemplateCandidates(message.text);
  const intent = inferDemoIntent(message.text, templateCandidates);

  return {
    ok: true,
    executionMode: DRY_RUN_ONLY,
    integrationRisk: INTEGRATION_RISK,
    safety: dryRunSafetyPayload(),
    intent,
    templateCandidates,
    unsupportedOperations: demoUnsupportedOperations(templateCandidates),
  };
}

export const createWorkflowAction: LoomAction = {
  name: 'CREATE_WORKFLOW',
  description: 'Create a dry-run DeFi automation workflow candidate from natural language.',
  handler: async (_runtime, message) => createDryRunWorkflowCandidate(message),
};

export const browseMarketplaceAction: LoomAction = {
  name: 'BROWSE_MARKETPLACE',
  description: 'List demo-safe workflow listings from the local loomlabs template registry.',
  handler: async () => ({
    ok: true,
    executionMode: DRY_RUN_ONLY,
    integrationRisk: INTEGRATION_RISK,
    safety: dryRunSafetyPayload(),
    items: templates.map((template) => ({
      id: `demo-${template.id}`,
      template: summarizeTemplate(template),
      pricing: { type: 'free' },
      source: 'local-demo-registry',
    })),
  }),
};

export const browseTemplatesAction: LoomAction = {
  name: 'BROWSE_TEMPLATES',
  description: 'Browse local templates with Sepolia dry-run metadata.',
  handler: async () => ({
    ok: true,
    executionMode: DRY_RUN_ONLY,
    integrationRisk: INTEGRATION_RISK,
    safety: dryRunSafetyPayload(),
    templates: templates.map(summarizeTemplate),
  }),
};

export const describeTemplateAction: LoomAction = {
  name: 'DESCRIBE_TEMPLATE',
  description: 'Describe one local template and its Sepolia dry-run metadata.',
  handler: async (_runtime, message) => {
    const templateId = extractTemplateId(message);
    const template = templateId
      ? templates.find((candidate) => candidate.id === templateId)
      : undefined;

    if (!template) {
      return {
        ok: false,
        executionMode: DRY_RUN_ONLY,
        integrationRisk: INTEGRATION_RISK,
        safety: dryRunSafetyPayload(),
        error: 'TEMPLATE_NOT_FOUND',
        availableTemplateIds: templates.map((candidate) => candidate.id),
      };
    }

    return {
      ok: true,
      executionMode: DRY_RUN_ONLY,
      integrationRisk: INTEGRATION_RISK,
      safety: dryRunSafetyPayload(),
      template: summarizeTemplate(template),
    };
  },
};

export const createWorkflowDemoAction: LoomAction = {
  name: 'CREATE_WORKFLOW_DEMO',
  description: 'Create a dry-run demo workflow candidate without API, KeeperHub, or chain calls.',
  handler: async (_runtime, message) => createDryRunWorkflowCandidate(message),
};

export const loomPlugin: LoomPlugin = {
  name: 'loomlabs',
  description: 'Natural-language DeFi workflow creation and marketplace, via KeeperHub.',
  integrationRisk: INTEGRATION_RISK,
  executionMode: DRY_RUN_ONLY,
  safety: {
    forbiddenRuntimeRequirements: ['signer', 'rpcUrl', 'wallet', 'privateKey'],
    noProductionExecutionTerms: [],
  },
  actions: [
    createWorkflowAction,
    browseMarketplaceAction,
    browseTemplatesAction,
    describeTemplateAction,
    createWorkflowDemoAction,
  ],
};

export default loomPlugin;
