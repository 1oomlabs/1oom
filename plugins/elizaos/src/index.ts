import type { Action, ActionResult, HandlerOptions, Memory, Plugin } from '@elizaos/core';
import {
  DRY_RUN_ONLY,
  findTemplatesByKeyword,
  getSepoliaTemplateMetadata,
  templates,
} from '@loomlabs/templates';

import { AxlClient } from './axl-client';
import { AXL_DRY_RUN_NOTICE, createAxlDryRunProjection } from './axl-dry-run';
import type { AxlConnectionType, AxlDryRunProjection } from './axl-dry-run';
import {
  canonicalWorkflowJson,
  createAxlDiscoveryMetadata,
  createAxlPublishDraft,
} from './axl-flow';
import type { AxlPublishDraft } from './axl-flow';

/**
 * ElizaOS plugin surface.
 *
 * Exposes demo-safe actions to agents:
 *   1. CREATE_WORKFLOW - turn a natural-language prompt into a dry-run workflow candidate.
 *   2. BROWSE_MARKETPLACE - discover marketplace entries without network calls.
 *   3. BROWSE_TEMPLATES - list local templates and Sepolia metadata status.
 *   4. DESCRIBE_TEMPLATE - describe one local template and its Sepolia demo metadata.
 *   5. CREATE_WORKFLOW_DEMO - create a dry-run demo workflow candidate only.
 *   6. CHECK/SEND/RECEIVE/EXECUTE AXL actions - opt-in semi-live AXL transport.
 *
 * Types follow @elizaos/core 2.0.0-alpha.77 while keeping the default actions dry-run only.
 * Runtime compatibility remains INTEGRATION_RISK until verified inside an actual ElizaOS agent.
 */

export const INTEGRATION_RISK = 'INTEGRATION_RISK' as const;

export type LoomAction = Action;

export type LoomPlugin = Plugin & {
  integrationRisk: typeof INTEGRATION_RISK;
  executionMode: typeof DRY_RUN_ONLY;
  safety: {
    forbiddenRuntimeRequirements: readonly string[];
    blockedExternalCalls: readonly string[];
    noProductionExecutionTerms: readonly string[];
  };
  axl: {
    executionMode: 'semi-live-opt-in';
    actions: readonly string[];
    requiredEnv: readonly string[];
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
  axlDryRun: AxlDryRunProjection;
  registryHints: AxlPublishDraft['registryHints'];
  onchainPublishDraft: AxlPublishDraft['onchainPublishDraft'];
  axlEnvelopeDraft: AxlPublishDraft['axlEnvelopeDraft'];
  templateCandidates: ReturnType<typeof summarizeTemplate>[];
  unsupportedOperations: string[];
};

type AxlDryRunOptions = {
  connectionType?: AxlConnectionType;
  peerId?: string;
  serviceName?: string;
  agentName?: string;
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
  axl?: AxlDryRunOptions;
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
  const axlDryRun = createAxlDryRunProjection({
    workflow: {
      id: workflowTemplate.id,
      name: workflowTemplate.name,
      protocol: workflowTemplate.protocol,
      category: workflowTemplate.category,
      description: workflowTemplate.description,
      chainId: workflowTemplate.sepolia?.chainId ?? null,
      network: workflowTemplate.sepolia?.network ?? null,
      parameters: intent.parameters,
      trigger: workflowTemplate.trigger,
      actions: workflowTemplate.actions,
    },
    userRequest: message.text,
    connectionType: message.axl?.connectionType,
    peerId: message.axl?.peerId,
    serviceName: message.axl?.serviceName,
    agentName: message.axl?.agentName,
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
    axlDryRun,
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
const validateAxlAction: LoomAction['validate'] = async () => true;

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

function getAxlDryRunOptions(
  options: HandlerOptions | Record<string, unknown> | undefined,
): AxlDryRunOptions {
  if (!options || !('parameters' in options) || typeof options.parameters !== 'object') {
    return {};
  }

  const parameters = options.parameters as Record<string, unknown> | null;
  const connectionType = parameters?.connectionType;

  return {
    connectionType:
      connectionType === 'MCP' || connectionType === 'A2A' ? connectionType : undefined,
    peerId: getStringParameter(parameters, 'peerId'),
    serviceName: getStringParameter(parameters, 'serviceName'),
    agentName: getStringParameter(parameters, 'agentName'),
  };
}

function getStringParameter(
  parameters: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = parameters?.[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function createAxlUnavailableResult(actionName: string, error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);

  return createSemiLiveActionResult(`${actionName} is unavailable: ${message}`, {
    ok: false,
    executionMode: 'semi-live-axl',
    integrationRisk: INTEGRATION_RISK,
    status: 'unavailable',
    error: message,
  });
}

function createSemiLiveActionResult(text: string, data: Record<string, unknown>): ActionResult {
  return {
    success: true,
    text,
    data: data as NonNullable<ActionResult['data']>,
  };
}

async function createAxlWorkflowEnvelope(message: Memory): Promise<AxlPublishDraft> {
  const data = await createDryRunWorkflowCandidate({ text: getMessageText(message) });

  return {
    axlFlow: data.axlFlow,
    registryHints: data.registryHints,
    onchainPublishDraft: data.onchainPublishDraft,
    axlEnvelopeDraft: data.axlEnvelopeDraft,
    canonicalWorkflowJson: canonicalWorkflowJson(data.axlEnvelopeDraft.payload.workflow),
  };
}

export const createWorkflowAction: LoomAction = {
  name: 'CREATE_WORKFLOW',
  description: 'Create a dry-run DeFi automation workflow candidate from natural language.',
  validate: validateDryRunAction,
  handler: async (_runtime, message, _state, options?: HandlerOptions | Record<string, unknown>) =>
    createActionResult(
      await createDryRunWorkflowCandidate({
        text: getPromptOption(options) ?? getMessageText(message),
        axl: getAxlDryRunOptions(options),
      }),
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
      axlModeNotice: AXL_DRY_RUN_NOTICE,
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
        const axlDryRun = createAxlDryRunProjection({
          workflow: {
            id: summary.id,
            name: summary.name,
            protocol: summary.protocol,
            category: summary.category,
            description: summary.description,
            chainId: summary.sepolia?.chainId ?? null,
            network: summary.sepolia?.network ?? null,
            parameters: intent.parameters,
            trigger: summary.trigger,
            actions: summary.actions,
          },
          userRequest: `Browse ${summary.name} as an AXL-compatible dry-run workflow`,
        });

        return {
          id: `demo-${template.id}`,
          template: summary,
          pricing: { type: 'free' },
          source: 'local-demo-registry',
          registryHints: axlPublishDraft.registryHints,
          onchainPublishDraft: axlPublishDraft.onchainPublishDraft,
          axlEnvelopeDraft: axlPublishDraft.axlEnvelopeDraft,
          axlDryRun,
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
        axl: getAxlDryRunOptions(options),
      }),
    ),
};

export const checkAxlNodeAction: LoomAction = {
  name: 'CHECK_AXL_NODE',
  description: 'Check the configured Gensyn AXL node topology.',
  validate: validateAxlAction,
  handler: async () => {
    try {
      const topology = await new AxlClient().getTopology();

      return createSemiLiveActionResult('Loaded AXL node topology.', {
        ok: true,
        executionMode: 'semi-live-axl',
        integrationRisk: INTEGRATION_RISK,
        topology,
      });
    } catch (error) {
      return createAxlUnavailableResult('CHECK_AXL_NODE', error);
    }
  },
};

export const sendAxlWorkflowDraftAction: LoomAction = {
  name: 'SEND_AXL_WORKFLOW_DRAFT',
  description: 'Send a workflow draft envelope through the configured Gensyn AXL node.',
  validate: validateAxlAction,
  handler: async (_runtime, message) => {
    try {
      const draft = await createAxlWorkflowEnvelope(message);
      const sendResult = await new AxlClient().sendEnvelope(draft.axlEnvelopeDraft);

      return createSemiLiveActionResult('Sent workflow draft envelope through AXL.', {
        ok: true,
        executionMode: 'semi-live-axl',
        integrationRisk: INTEGRATION_RISK,
        sendResult,
        onchainPublishDraft: draft.onchainPublishDraft,
        axlEnvelopeDraft: draft.axlEnvelopeDraft,
      });
    } catch (error) {
      return createAxlUnavailableResult('SEND_AXL_WORKFLOW_DRAFT', error);
    }
  },
};

export const receiveAxlMessagesAction: LoomAction = {
  name: 'RECEIVE_AXL_MESSAGES',
  description: 'Receive one pending Gensyn AXL message from the configured node.',
  validate: validateAxlAction,
  handler: async () => {
    try {
      const message = await new AxlClient().receiveMessage();

      return createSemiLiveActionResult(
        message ? 'Received one AXL message.' : 'No AXL messages are pending.',
        {
          ok: true,
          executionMode: 'semi-live-axl',
          integrationRisk: INTEGRATION_RISK,
          status: message ? 'received' : 'empty',
          message,
        },
      );
    } catch (error) {
      return createAxlUnavailableResult('RECEIVE_AXL_MESSAGES', error);
    }
  },
};

export const executeReceivedAxlWorkflowAction: LoomAction = {
  name: 'EXECUTE_RECEIVED_AXL_WORKFLOW',
  description: 'Receive a verified AXL workflow envelope and hand it to the Loom API pipeline.',
  validate: validateAxlAction,
  handler: async () => {
    try {
      const client = new AxlClient();
      const message = await client.receiveMessage();

      if (!message) {
        return createSemiLiveActionResult('No AXL workflow envelope is pending for execution.', {
          ok: false,
          executionMode: 'semi-live-axl',
          integrationRisk: INTEGRATION_RISK,
          status: 'empty',
        });
      }

      const execution = await client.executeReceivedWorkflow(message);

      return createSemiLiveActionResult(
        'Submitted received AXL workflow to the Loom API execution pipeline.',
        {
          ok: true,
          executionMode: 'semi-live-axl',
          integrationRisk: INTEGRATION_RISK,
          status: 'submitted',
          fromPeerId: message.fromPeerId,
          execution,
        },
      );
    } catch (error) {
      return createAxlUnavailableResult('EXECUTE_RECEIVED_AXL_WORKFLOW', error);
    }
  },
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
  axl: {
    executionMode: 'semi-live-opt-in',
    actions: [
      'CHECK_AXL_NODE',
      'SEND_AXL_WORKFLOW_DRAFT',
      'RECEIVE_AXL_MESSAGES',
      'EXECUTE_RECEIVED_AXL_WORKFLOW',
    ],
    requiredEnv: [
      'AXL_NODE_URL',
      'AXL_DESTINATION_PEER_ID',
      'LOOM_API_URL',
      'LOOM_WORKFLOW_OWNER',
      'ENABLE_AXL_AGENT_EXECUTION',
    ],
  },
  actions: [
    createWorkflowAction,
    browseMarketplaceAction,
    browseTemplatesAction,
    describeTemplateAction,
    createWorkflowDemoAction,
    checkAxlNodeAction,
    sendAxlWorkflowDraftAction,
    receiveAxlMessagesAction,
    executeReceivedAxlWorkflowAction,
  ],
};

export default loomPlugin;
