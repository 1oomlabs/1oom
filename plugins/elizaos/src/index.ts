import type { Action, ActionResult, HandlerOptions, Memory, Plugin } from '@elizaos/core';
import {
  DRY_RUN_ONLY,
  findTemplatesByKeyword,
  getSepoliaTemplateMetadata,
  templates,
} from '@loomlabs/templates';

import { createAxlDiscoveryMetadata, createAxlPublishDraft } from './axl-flow';
import type { AxlPublishDraft } from './axl-flow';
import {
  CREATE_WORKFLOW_LIVE_ACTION_NAME,
  LIVE_EXECUTION_FEATURE_FLAG,
  LIVE_RUN,
  executeLiveExecutionRequest,
} from './live-execution';

/**
 * ElizaOS plugin surface.
 *
 * Exposes demo-safe actions to agents:
 *   1. CREATE_WORKFLOW - turn a natural-language prompt into dry-run or env-selected live workflow handling.
 *   2. BROWSE_MARKETPLACE - discover marketplace entries without network calls.
 *   3. BROWSE_TEMPLATES - list local templates and Sepolia metadata status.
 *   4. DESCRIBE_TEMPLATE - describe one local template and its Sepolia demo metadata.
 *   5. CREATE_WORKFLOW_DEMO - create a dry-run demo workflow candidate only.
 *   6. CREATE_WORKFLOW_LIVE - explicit live-run request guarded by env, confirmation, signer, and reader checks.
 *
 * Types follow @elizaos/core 2.0.0-alpha.77 while keeping dry-run as the safe default.
 * Runtime compatibility remains INTEGRATION_RISK until verified inside an actual ElizaOS agent.
 */

export const INTEGRATION_RISK = 'INTEGRATION_RISK' as const;
export const EXECUTION_MODE_ENV_VAR = 'LOOM_ELIZAOS_EXECUTION_MODE' as const;
export const LIVE_CONFIRMATION_ENV_VAR = 'LOOM_CONFIRM_SEPOLIA_LIVE_EXECUTION' as const;

export type LoomAction = Action;

export type LoomPlugin = Plugin & {
  integrationRisk: typeof INTEGRATION_RISK;
  executionMode: typeof DRY_RUN_ONLY;
  safety: {
    forbiddenRuntimeRequirements: readonly string[];
    blockedExternalCalls: readonly string[];
    noProductionExecutionTerms: readonly string[];
  };
  actions: LoomAction[];
};

type DemoWorkflowCandidate = {
  ok: boolean;
  executionMode: typeof DRY_RUN_ONLY;
  integrationRisk: typeof INTEGRATION_RISK;
  safety: ReturnType<typeof dryRunSafetyPayload>;
  templateId: string;
  templateName: string;
  protocol: string;
  category: string;
  description: string;
  chainId: number | null;
  network: string | null;
  parameters: Record<string, unknown>;
  trigger: ReturnType<typeof summarizeTemplate>['trigger'];
  actions: ReturnType<typeof summarizeTemplate>['actions'];
  runtimePlaceholderValues: NonNullable<
    ReturnType<typeof summarizeTemplate>['sepolia']
  >['runtimePlaceholderValues'];
  contracts: NonNullable<ReturnType<typeof summarizeTemplate>['sepolia']>['contracts'];
  intent: DemoIntent;
  workflowDraft: DryRunWorkflowDraft;
  axlFlow: AxlPublishDraft['axlFlow'];
  registryHints: AxlPublishDraft['registryHints'];
  onchainPublishDraft: AxlPublishDraft['onchainPublishDraft'];
  axlEnvelopeDraft: AxlPublishDraft['axlEnvelopeDraft'];
  templateCandidates: ReturnType<typeof summarizeTemplate>[];
  unsupportedOperations: string[];
};

type DemoIntent = {
  templateId: string;
  confidence: number;
  parameters: Record<string, unknown>;
  reasoning: string;
};

type DryRunWorkflowDraft = {
  templateId: string;
  chainId: number | null;
  network: string | null;
  executionMode: typeof DRY_RUN_ONLY;
  parameters: Record<string, unknown>;
  trigger: ReturnType<typeof summarizeTemplate>['trigger'];
  actions: ReturnType<typeof summarizeTemplate>['actions'];
  runtimePlaceholderValues: NonNullable<
    ReturnType<typeof summarizeTemplate>['sepolia']
  >['runtimePlaceholderValues'];
  contracts: NonNullable<ReturnType<typeof summarizeTemplate>['sepolia']>['contracts'];
  unsupportedOperations: string[];
  deployStatus: 'dry-run-not-submitted';
  deployBlockedBy: string[];
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
          contracts: metadata.contracts,
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

  const keywordMatches = templates.filter((template) => {
    if (template.intentKeywords.some((keyword) => promptLower.includes(keyword.toLowerCase()))) {
      return true;
    }

    return (
      promptLower.includes(template.protocol.toLowerCase()) ||
      promptLower.includes(template.category.toLowerCase())
    );
  });

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
    callsKeeperHub: false,
    callsExternalLlm: false,
    callsAppApi: false,
    requiresSigner: false,
    requiresRpc: false,
    requiresWallet: false,
    requiresPrivateKey: false,
    requiresApiKey: false,
    executionBlockedBy: [
      'dry-run-only',
      'no-signer',
      'no-rpc',
      'no-wallet',
      'no-transaction-broadcast',
      'no-keeperhub-deploy',
      'no-llm-api-call',
      'no-app-api-call',
    ],
  };
}

function createDryRunWorkflowDraft(
  template: ReturnType<typeof summarizeTemplate>,
  intent: DemoIntent,
  unsupportedOperations: string[],
): DryRunWorkflowDraft {
  return {
    templateId: template.id,
    chainId: template.sepolia?.chainId ?? null,
    network: template.sepolia?.network ?? null,
    executionMode: DRY_RUN_ONLY,
    parameters: intent.parameters,
    trigger: template.trigger,
    actions: template.actions,
    runtimePlaceholderValues: template.sepolia?.runtimePlaceholderValues ?? [],
    contracts: template.sepolia?.contracts ?? [],
    unsupportedOperations,
    deployStatus: 'dry-run-not-submitted',
    deployBlockedBy: ['keeperhub-deploy', 'api-deploy', 'real-transaction-execution'],
  };
}

async function createDryRunWorkflowCandidate(message: {
  text: string;
}): Promise<DemoWorkflowCandidate> {
  const templateCandidates = findTemplateCandidates(message.text);
  const intent = inferDemoIntent(message.text, templateCandidates);
  const primaryCandidate = templateCandidates[0];
  const fallbackTemplate = templates[0];
  const workflowTemplate =
    primaryCandidate ?? (fallbackTemplate ? summarizeTemplate(fallbackTemplate) : undefined);
  const unsupportedOperations = demoUnsupportedOperations(templateCandidates);

  if (!workflowTemplate) {
    throw new Error('Template registry must expose at least one template.');
  }

  const axlPublishDraft = createAxlPublishDraft({
    templateId: workflowTemplate.id,
    templateName: workflowTemplate.name,
    protocol: workflowTemplate.protocol,
    category: workflowTemplate.category,
    chainId: workflowTemplate.sepolia?.chainId ?? null,
    network: workflowTemplate.sepolia?.network ?? null,
    parameters: intent.parameters,
    trigger: workflowTemplate.trigger,
    actions: workflowTemplate.actions,
    runtimePlaceholderValues: workflowTemplate.sepolia?.runtimePlaceholderValues ?? [],
    contracts: workflowTemplate.sepolia?.contracts ?? [],
    unsupportedOperations,
  });

  return {
    ok: true,
    executionMode: DRY_RUN_ONLY,
    integrationRisk: INTEGRATION_RISK,
    safety: dryRunSafetyPayload(),
    templateId: workflowTemplate.id,
    templateName: workflowTemplate.name,
    protocol: workflowTemplate.protocol,
    category: workflowTemplate.category,
    description: workflowTemplate.description,
    chainId: workflowTemplate.sepolia?.chainId ?? null,
    network: workflowTemplate.sepolia?.network ?? null,
    parameters: intent.parameters,
    trigger: workflowTemplate.trigger,
    actions: workflowTemplate.actions,
    runtimePlaceholderValues: workflowTemplate.sepolia?.runtimePlaceholderValues ?? [],
    contracts: workflowTemplate.sepolia?.contracts ?? [],
    intent,
    workflowDraft: createDryRunWorkflowDraft(workflowTemplate, intent, unsupportedOperations),
    axlFlow: axlPublishDraft.axlFlow,
    registryHints: axlPublishDraft.registryHints,
    onchainPublishDraft: axlPublishDraft.onchainPublishDraft,
    axlEnvelopeDraft: axlPublishDraft.axlEnvelopeDraft,
    templateCandidates,
    unsupportedOperations,
  };
}

function createDryRunWorkflowText(data: DemoWorkflowCandidate): string {
  const blockedOperations = data.unsupportedOperations.slice(0, 3).join(', ');

  return [
    `Selected ${data.templateId} (${data.templateName}) for ${data.protocol}/${data.category}.`,
    `Mode: ${data.executionMode} on ${data.network ?? 'unknown-network'}.`,
    `Execution is unavailable because ${blockedOperations}.`,
    'No transaction was executed.',
  ].join(' ');
}

function createActionResult(data: DemoWorkflowCandidate): ActionResult {
  return {
    success: data.ok,
    text: createDryRunWorkflowText(data),
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

function getHandlerParameters(
  options: HandlerOptions | Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!options || !('parameters' in options) || typeof options.parameters !== 'object') {
    return {};
  }

  return (options.parameters as Record<string, unknown> | null) ?? {};
}

function getPromptOption(
  options: HandlerOptions | Record<string, unknown> | undefined,
): string | undefined {
  const prompt = getHandlerParameters(options).prompt;

  return typeof prompt === 'string' ? prompt : undefined;
}

function getRecordParameter(
  parameters: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = parameters[key];

  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getNumberParameter(parameters: Record<string, unknown>, key: string): number | undefined {
  const value = parameters[key];

  return typeof value === 'number' ? value : undefined;
}

function getStringParameter(
  parameters: Record<string, unknown>,
  key: string,
): `0x${string}` | undefined {
  const value = parameters[key];

  return typeof value === 'string' && value.startsWith('0x') ? (value as `0x${string}`) : undefined;
}

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

function getEnvironmentValue(key: string): string | undefined {
  return (globalThis as typeof globalThis & { process?: ProcessLike }).process?.env?.[key];
}

function isTruthyConfigValue(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on', 'live', 'live-run'].includes(value.trim().toLowerCase());
}

function getConfiguredExecutionMode(
  parameters: Record<string, unknown>,
): typeof DRY_RUN_ONLY | typeof LIVE_RUN {
  const requestedMode = parameters.executionMode;

  if (requestedMode === LIVE_RUN || requestedMode === DRY_RUN_ONLY) {
    return requestedMode;
  }

  return getEnvironmentValue(EXECUTION_MODE_ENV_VAR)?.trim().toLowerCase() === LIVE_RUN
    ? LIVE_RUN
    : DRY_RUN_ONLY;
}

function getConfiguredFeatureFlags(parameters: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(isTruthyConfigValue(getEnvironmentValue(LIVE_EXECUTION_FEATURE_FLAG))
      ? { [LIVE_EXECUTION_FEATURE_FLAG]: true }
      : {}),
    ...(getRecordParameter(parameters, 'featureFlags') ?? {}),
  };
}

function getConfiguredLiveConfirmation(parameters: Record<string, unknown>): boolean {
  return (
    parameters.confirmLiveExecution === true ||
    isTruthyConfigValue(getEnvironmentValue(LIVE_CONFIRMATION_ENV_VAR))
  );
}

function toActionData(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toActionData);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        toActionData(entry),
      ]),
    );
  }

  return value;
}

export const createWorkflowAction: LoomAction = {
  name: 'CREATE_WORKFLOW',
  description:
    'Create a workflow candidate from natural language, using LOOM_ELIZAOS_EXECUTION_MODE to choose dry-run or live-run.',
  validate: validateDryRunAction,
  handler: async (
    _runtime,
    message,
    _state,
    options?: HandlerOptions | Record<string, unknown>,
  ) => {
    const handlerParameters = getHandlerParameters(options);
    const prompt = getPromptOption(options) ?? getMessageText(message);

    if (getConfiguredExecutionMode(handlerParameters) === LIVE_RUN) {
      return createLiveWorkflowActionResult(prompt, handlerParameters);
    }

    return createActionResult(await createDryRunWorkflowCandidate({ text: prompt }));
  },
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
      ...createAxlDiscoveryMetadata(),
      items: templates.map((template) => {
        const summary = summarizeTemplate(template);
        const intent = inferDemoIntent(template.id, [summary]);
        const unsupportedOperations = demoUnsupportedOperations([summary]);
        const axlPublishDraft = createAxlPublishDraft({
          templateId: summary.id,
          templateName: summary.name,
          protocol: summary.protocol,
          category: summary.category,
          chainId: summary.sepolia?.chainId ?? null,
          network: summary.sepolia?.network ?? null,
          parameters: intent.parameters,
          trigger: summary.trigger,
          actions: summary.actions,
          runtimePlaceholderValues: summary.sepolia?.runtimePlaceholderValues ?? [],
          contracts: summary.sepolia?.contracts ?? [],
          unsupportedOperations,
        });

        return {
          id: `demo-${template.id}`,
          template: summary,
          pricing: { type: 'free' },
          source: 'local-demo-registry',
          registryHints: axlPublishDraft.registryHints,
          onchainPublishDraft: axlPublishDraft.onchainPublishDraft,
          axlEnvelopeDraft: axlPublishDraft.axlEnvelopeDraft,
        };
      }),
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
      await createDryRunWorkflowCandidate({
        text: getPromptOption(options) ?? getMessageText(message),
      }),
    ),
};

async function createLiveWorkflowActionResult(
  prompt: string,
  handlerParameters: Record<string, unknown>,
): Promise<ActionResult> {
  const templateCandidates = findTemplateCandidates(prompt);
  const selectedTemplate = templateCandidates[0];
  const templateId = selectedTemplate?.id ?? templates[0]?.id ?? 'unknown-template';
  const intent = inferDemoIntent(prompt, templateCandidates);
  const liveParameters = {
    ...intent.parameters,
    ...(getRecordParameter(handlerParameters, 'parameters') ?? {}),
  };
  const liveResult = await executeLiveExecutionRequest({
    templateId,
    chainId:
      getNumberParameter(handlerParameters, 'chainId') ??
      selectedTemplate?.sepolia?.chainId ??
      11155111,
    executionMode: LIVE_RUN,
    confirmLiveExecution: getConfiguredLiveConfirmation(handlerParameters),
    featureFlags: getConfiguredFeatureFlags(handlerParameters),
    signer: handlerParameters.signer as never,
    reader: handlerParameters.reader as never,
    account: getStringParameter(handlerParameters, 'account'),
    parameters: liveParameters,
    metadata: getSepoliaTemplateMetadata(templateId),
  });

  if (!liveResult.ok) {
    return {
      success: false,
      text: `Live execution is blocked for ${templateId}: ${liveResult.code}. No transaction was prepared or broadcast.`,
      error: liveResult.code,
      data: {
        ok: false,
        executionMode: DRY_RUN_ONLY,
        requestedExecutionMode: LIVE_RUN,
        integrationRisk: INTEGRATION_RISK,
        safety: {
          ...dryRunSafetyPayload(),
          canPrepareTransactions: liveResult.safety.canPrepareTransactions,
          canBroadcastTransactions: liveResult.safety.canBroadcastTransactions,
        },
        liveResult,
      },
    };
  }

  return {
    success: true,
    text: `Live execution completed for ${templateId} with ${liveResult.transactionHashes.length} transaction(s).`,
    data: {
      ok: true,
      executionMode: LIVE_RUN,
      requestedExecutionMode: LIVE_RUN,
      integrationRisk: INTEGRATION_RISK,
      liveResult: toActionData(liveResult),
    } as unknown as NonNullable<ActionResult['data']>,
  };
}

export const createWorkflowLiveAction: LoomAction = {
  name: CREATE_WORKFLOW_LIVE_ACTION_NAME,
  description: 'Execute a Sepolia live-run through host-injected signer and reader adapters.',
  validate: validateDryRunAction,
  handler: async (_runtime, message, _state, options?: HandlerOptions | Record<string, unknown>) =>
    createLiveWorkflowActionResult(
      getPromptOption(options) ?? getMessageText(message),
      getHandlerParameters(options),
    ),
};

export const loomPlugin: LoomPlugin = {
  name: 'loomlabs',
  description: 'Natural-language DeFi workflow creation and marketplace, via KeeperHub.',
  integrationRisk: INTEGRATION_RISK,
  executionMode: DRY_RUN_ONLY,
  safety: {
    forbiddenRuntimeRequirements: ['signer', 'rpcUrl', 'wallet', 'privateKey', 'apiKey'],
    blockedExternalCalls: ['keeperhub-deploy', 'llm-api-call', 'apps-api-call'],
    noProductionExecutionTerms: [],
  },
  actions: [
    createWorkflowAction,
    browseMarketplaceAction,
    browseTemplatesAction,
    describeTemplateAction,
    createWorkflowDemoAction,
    createWorkflowLiveAction,
  ],
};

export default loomPlugin;
