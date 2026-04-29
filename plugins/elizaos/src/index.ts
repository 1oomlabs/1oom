import type { Action, ActionResult, HandlerOptions, Memory, Plugin } from '@elizaos/core';
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
 * Types follow @elizaos/core 2.0.0-alpha.77 while keeping every action dry-run only.
 * Runtime compatibility remains INTEGRATION_RISK until verified inside an actual ElizaOS agent.
 */

export const INTEGRATION_RISK = 'INTEGRATION_RISK' as const;

export type LoomAction = Action;

export type LoomPlugin = Plugin & {
  integrationRisk: typeof INTEGRATION_RISK;
  executionMode: typeof DRY_RUN_ONLY;
  safety: {
    forbiddenRuntimeRequirements: readonly string[];
    noProductionExecutionTerms: readonly string[];
  };
  actions: LoomAction[];
};

type DemoWorkflowCandidate = {
  ok: boolean;
  executionMode: typeof DRY_RUN_ONLY;
  integrationRisk: typeof INTEGRATION_RISK;
  safety: ReturnType<typeof dryRunSafetyPayload>;
  intent: DemoIntent;
  templateCandidates: ReturnType<typeof summarizeTemplate>[];
  unsupportedOperations: string[];
};

type DemoIntent = {
  templateId: string;
  confidence: number;
  parameters: Record<string, unknown>;
  reasoning: string;
};

function getMessageText(message: Memory): string {
  return typeof message.content.text === 'string' ? message.content.text : '';
}

function extractTemplateId(message: Memory): string | undefined {
  const trimmed = getMessageText(message).trim();

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

function createActionResult(text: string, data: DemoWorkflowCandidate): ActionResult {
  return {
    success: data.ok,
    text,
    data: data as unknown as NonNullable<ActionResult['data']>,
  };
}

function createTemplateNotFoundResult(): ActionResult {
  return {
    success: false,
    text: 'Template not found in the local dry-run registry.',
    error: 'TEMPLATE_NOT_FOUND',
    data: {
      ok: false,
      executionMode: DRY_RUN_ONLY,
      integrationRisk: INTEGRATION_RISK,
      safety: dryRunSafetyPayload(),
      error: 'TEMPLATE_NOT_FOUND',
      availableTemplateIds: templates.map((candidate) => candidate.id),
    },
  };
}

const validateDryRunAction: LoomAction['validate'] = async () => true;

function getPromptOption(
  options: HandlerOptions | Record<string, unknown> | undefined,
): string | undefined {
  if (!options || !('parameters' in options) || typeof options.parameters !== 'object') {
    return undefined;
  }

  const parameters = options.parameters as Record<string, unknown> | null;
  const prompt = parameters?.prompt;

  return typeof prompt === 'string' ? prompt : undefined;
}

export const createWorkflowAction: LoomAction = {
  name: 'CREATE_WORKFLOW',
  description: 'Create a dry-run DeFi automation workflow candidate from natural language.',
  validate: validateDryRunAction,
  handler: async (_runtime, message) =>
    createActionResult(
      'Created a dry-run workflow candidate. No transaction was executed.',
      await createDryRunWorkflowCandidate({ text: getMessageText(message) }),
    ),
};

export const browseMarketplaceAction: LoomAction = {
  name: 'BROWSE_MARKETPLACE',
  description: 'List demo-safe workflow listings from the local loomlabs template registry.',
  validate: validateDryRunAction,
  handler: async () => ({
    success: true,
    text: 'Loaded dry-run marketplace entries from the local template registry.',
    data: {
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
    },
  }),
};

export const browseTemplatesAction: LoomAction = {
  name: 'BROWSE_TEMPLATES',
  description: 'Browse local templates with Sepolia dry-run metadata.',
  validate: validateDryRunAction,
  handler: async () => ({
    success: true,
    text: 'Loaded local templates with Sepolia dry-run metadata.',
    data: {
      ok: true,
      executionMode: DRY_RUN_ONLY,
      integrationRisk: INTEGRATION_RISK,
      safety: dryRunSafetyPayload(),
      templates: templates.map(summarizeTemplate),
    },
  }),
};

export const describeTemplateAction: LoomAction = {
  name: 'DESCRIBE_TEMPLATE',
  description: 'Describe one local template and its Sepolia dry-run metadata.',
  validate: validateDryRunAction,
  handler: async (_runtime, message) => {
    const templateId = extractTemplateId(message);
    const template = templateId
      ? templates.find((candidate) => candidate.id === templateId)
      : undefined;

    if (!template) {
      return createTemplateNotFoundResult();
    }

    return {
      success: true,
      text: `Loaded dry-run metadata for ${template.id}.`,
      data: {
        ok: true,
        executionMode: DRY_RUN_ONLY,
        integrationRisk: INTEGRATION_RISK,
        safety: dryRunSafetyPayload(),
        template: summarizeTemplate(template),
      },
    };
  },
};

export const createWorkflowDemoAction: LoomAction = {
  name: 'CREATE_WORKFLOW_DEMO',
  description: 'Create a dry-run demo workflow candidate without API, KeeperHub, or chain calls.',
  validate: validateDryRunAction,
  handler: async (_runtime, message, _state, options?: HandlerOptions | Record<string, unknown>) =>
    createActionResult(
      'Created a dry-run demo workflow candidate. No transaction was executed.',
      await createDryRunWorkflowCandidate({
        text: getPromptOption(options) ?? getMessageText(message),
      }),
    ),
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
