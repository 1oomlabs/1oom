import type { ActionResult, IAgentRuntime, Memory } from '@elizaos/core';
import { templateSchema } from '@loomlabs/schema';
import {
  findTemplatesByKeyword,
  getTemplateById,
  templates as templateRegistry,
} from '@loomlabs/templates';

import { runElizaOsRuntimeLoadingTest } from './elizaos-runtime-loading.test';
import loomPlugin from './index';
import { runPhase1ElizaOsSmokeTests } from './phase-1-smoke.test';

declare const console: {
  log: (message?: unknown, ...optionalParams: unknown[]) => void;
};

declare const process: {
  argv: string[];
};

declare global {
  interface ImportMeta {
    url: string;
  }
}

type RuntimeSmokeResult = {
  actionNames: string[];
  integrationCases: string[];
  runtimeLoading: Awaited<ReturnType<typeof runElizaOsRuntimeLoadingTest>>;
  phase1Passed: number;
};

type TemplateSummary = {
  id: string;
  name?: string;
  description?: string;
  protocol?: string;
  category?: string;
  parameters?: unknown[];
  trigger?: unknown;
  actions?: unknown[];
  sepolia?: {
    executionMode?: string;
    contracts?: Array<{ contract: string; address?: { value?: string } }>;
  };
};

type DryRunWorkflowDraftSummary = {
  templateId?: string;
  chainId?: number | null;
  network?: string | null;
  executionMode?: string;
  parameters?: Record<string, unknown>;
  actions?: unknown[];
  runtimePlaceholderValues?: unknown[];
  contracts?: unknown[];
  unsupportedOperations?: string[];
  deployStatus?: string;
  deployBlockedBy?: string[];
};

type MarketplaceItemSummary = {
  id: string;
  template?: TemplateSummary;
  pricing?: { type?: string };
  source?: string;
  registryHints?: RegistryHintsSummary;
  onchainPublishDraft?: OnchainPublishDraftSummary;
  axlEnvelopeDraft?: AxlEnvelopeDraftSummary;
};

type AxlFlowSummary = {
  protocol?: string;
  mode?: string;
  transport?: string;
  nodeApi?: Record<string, string>;
  blockedBy?: string[];
};

type RegistryHintsSummary = {
  contract?: string;
  registerFunction?: string;
  curationFlow?: string;
  contentHashAlgorithm?: string;
};

type OnchainPublishDraftSummary = {
  contentHash?: string;
  uri?: string;
  expectedStatus?: string;
  author?: string;
  registerCall?: {
    contract?: string;
    functionName?: string;
    args?: unknown[];
  };
  blockedBy?: string[];
};

type AxlEnvelopeDraftSummary = {
  version?: string;
  kind?: string;
  transport?: string;
  route?: Record<string, string>;
  payload?: {
    contentHash?: string;
    uri?: string;
  };
};

const marketplaceTemplateFields = [
  'id',
  'name',
  'description',
  'protocol',
  'category',
  'parameters',
  'trigger',
  'actions',
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const mockRuntime = {} as IAgentRuntime;

function mockMessage(text: string): Memory {
  return {
    entityId: '00000000-0000-0000-0000-000000000001',
    roomId: '00000000-0000-0000-0000-000000000002',
    content: {
      text,
      source: 'runtime-smoke-test',
    },
  } as Memory;
}

function assertActionResult(actionName: string, result: ActionResult | undefined): void {
  assert(result, `${actionName} must return an ActionResult`);
  assert(result.success === true, `${actionName} must return success=true`);
  assert(typeof result.text === 'string', `${actionName} must return text`);
  assert(result.data, `${actionName} must return data`);

  const serialized = JSON.stringify(result);

  assert(serialized.includes('dry-run-only'), `${actionName} must stay dry-run-only`);
  assert(!serialized.includes('privateKey'), `${actionName} must not require private keys`);
  assert(!serialized.includes('rpcUrl'), `${actionName} must not require RPC URLs`);
  assert(!serialized.includes('apiKey'), `${actionName} must not require API keys`);
  assert(!serialized.includes('keeperhubClient'), `${actionName} must not expose KeeperHub client`);
  assert(!serialized.includes('fetch('), `${actionName} must not expose fetch calls`);
  assert(!serialized.includes('transactionHash'), `${actionName} must not return tx hashes`);
}

function assertDryRunSafety(actionName: string, result: ActionResult | undefined): void {
  const data = getDataRecord(result);
  const safety = data.safety as Record<string, unknown> | undefined;

  assert(safety, `${actionName} must include safety metadata`);
  assert(safety.callsKeeperHub === false, `${actionName} must not call KeeperHub`);
  assert(safety.callsExternalLlm === false, `${actionName} must not call external LLMs`);
  assert(safety.callsAppApi === false, `${actionName} must not call app APIs`);
  assert(safety.requiresApiKey === false, `${actionName} must not require API keys`);
  assert(safety.requiresSigner === false, `${actionName} must not require signer`);
  assert(safety.requiresRpc === false, `${actionName} must not require RPC`);
}

function getDataRecord(result: ActionResult | undefined): Record<string, unknown> {
  assert(result?.data, 'ActionResult must expose data');
  return result.data as Record<string, unknown>;
}

function getTemplates(result: ActionResult | undefined): TemplateSummary[] {
  const data = getDataRecord(result);
  const value = data.templates;

  assert(Array.isArray(value), 'BROWSE_TEMPLATES must return templates array');
  return value as TemplateSummary[];
}

function getMarketplaceItems(result: ActionResult | undefined): MarketplaceItemSummary[] {
  const data = getDataRecord(result);
  const value = data.items;

  assert(Array.isArray(value), 'BROWSE_MARKETPLACE must return items array');
  return value as MarketplaceItemSummary[];
}

function getDescribedTemplate(result: ActionResult | undefined): TemplateSummary {
  const data = getDataRecord(result);
  const value = data.template;

  assert(value && typeof value === 'object', 'DESCRIBE_TEMPLATE must return template object');
  return value as TemplateSummary;
}

function getCandidateIds(result: ActionResult | undefined): string[] {
  const data = getDataRecord(result);
  const value = data.templateCandidates;

  assert(Array.isArray(value), 'CREATE_WORKFLOW_DEMO must return templateCandidates array');
  return (value as TemplateSummary[]).map((template) => template.id);
}

function getWorkflowDraft(result: ActionResult | undefined): DryRunWorkflowDraftSummary {
  const data = getDataRecord(result);
  const value = data.workflowDraft;

  assert(value && typeof value === 'object', 'CREATE_WORKFLOW_DEMO must return workflowDraft');
  return value as DryRunWorkflowDraftSummary;
}

function assertDryRunWorkflowDraft(
  result: ActionResult | undefined,
  expectedTemplateId: string,
): void {
  const draft = getWorkflowDraft(result);

  assert(draft.templateId === expectedTemplateId, 'workflowDraft must match selected template');
  assert(draft.chainId === 11155111, 'workflowDraft must target Sepolia');
  assert(draft.network === 'sepolia', 'workflowDraft network must be sepolia');
  assert(draft.executionMode === 'dry-run-only', 'workflowDraft must stay dry-run-only');
  assert(draft.parameters && typeof draft.parameters === 'object', 'workflowDraft needs params');
  assert(Array.isArray(draft.actions), 'workflowDraft actions must be an array');
  assert(
    Array.isArray(draft.runtimePlaceholderValues),
    'workflowDraft runtimePlaceholderValues must be an array',
  );
  assert(Array.isArray(draft.contracts), 'workflowDraft contracts must be an array');
  assert(Array.isArray(draft.unsupportedOperations), 'workflowDraft must list blocked operations');
  assert(
    draft.unsupportedOperations.includes('keeperhub-deploy'),
    'workflowDraft must block KeeperHub deploy',
  );
  assert(
    draft.unsupportedOperations.includes('api-deploy'),
    'workflowDraft must block app API deploy',
  );
  assert(draft.deployStatus === 'dry-run-not-submitted', 'workflowDraft must not be submitted');
  assert(
    draft.deployBlockedBy?.includes('real-transaction-execution'),
    'workflowDraft must block real transaction execution',
  );
}

function assertAxlFlowMetadata(actionName: string, data: Record<string, unknown>): void {
  const flow = data.axlFlow as AxlFlowSummary | undefined;
  const registryHints = data.registryHints as RegistryHintsSummary | undefined;

  assert(flow, `${actionName} must expose axlFlow`);
  assert(flow.protocol === 'gensyn-axl', `${actionName} axlFlow protocol must be gensyn-axl`);
  assert(flow.mode === 'dry-run-only', `${actionName} axlFlow must stay dry-run-only`);
  assert(flow.transport === 'raw-message', `${actionName} axlFlow must use raw-message`);
  assert(flow.nodeApi?.send === 'POST /send', `${actionName} must document AXL /send`);
  assert(flow.nodeApi?.recv === 'GET /recv', `${actionName} must document AXL /recv`);
  assert(flow.nodeApi?.topology === 'GET /topology', `${actionName} must document topology`);
  assert(flow.nodeApi?.a2a === 'POST /a2a/{peer_id}', `${actionName} must document A2A`);
  assert(flow.blockedBy?.includes('dry-run-only'), `${actionName} must block live AXL calls`);

  assert(registryHints, `${actionName} must expose registryHints`);
  assert(
    registryHints.contract === 'MarketplaceRegistry',
    `${actionName} registryHints must target MarketplaceRegistry`,
  );
  assert(
    registryHints.registerFunction === 'register(bytes32,string)',
    `${actionName} must describe register call`,
  );
  assert(
    registryHints.contentHashAlgorithm === 'keccak256(canonical workflow JSON)',
    `${actionName} must describe content hash algorithm`,
  );
}

function assertOnchainPublishDraft(actionName: string, draft: OnchainPublishDraftSummary): void {
  assert(/^0x[0-9a-f]{64}$/i.test(draft.contentHash ?? ''), `${actionName} needs bytes32 hash`);
  assert(draft.uri?.startsWith('loom://workflow/'), `${actionName} needs loom workflow URI`);
  assert(draft.expectedStatus === 'Pending', `${actionName} must create pending draft`);
  assert(draft.author === 'runtime-signer-required', `${actionName} must require runtime author`);
  assert(draft.registerCall?.contract === 'MarketplaceRegistry', `${actionName} call contract`);
  assert(draft.registerCall?.functionName === 'register', `${actionName} call function`);
  assert(draft.registerCall?.args?.length === 2, `${actionName} register args`);
  assert(draft.blockedBy?.includes('no-transaction-broadcast'), `${actionName} blocks broadcast`);
}

function assertAxlEnvelopeDraft(actionName: string, draft: AxlEnvelopeDraftSummary): void {
  assert(draft.version === 'loomlabs.axl.v1', `${actionName} envelope version`);
  assert(draft.transport === 'axl.raw', `${actionName} envelope transport`);
  assert(draft.route?.sendEndpoint === '/send', `${actionName} envelope send endpoint`);
  assert(draft.route?.recvEndpoint === '/recv', `${actionName} envelope recv endpoint`);
}

function assertDemoResponseQuality(
  result: ActionResult | undefined,
  expectedTemplateId: string,
): void {
  const data = getDataRecord(result);
  const text = result?.text ?? '';
  const draft = getWorkflowDraft(result);

  assert(text.includes(expectedTemplateId), 'demo text must include selected template ID');
  assert(text.includes('dry-run-only'), 'demo text must explain dry-run mode');
  assert(text.includes('unavailable'), 'demo text must explain execution is unavailable');
  assert(data.templateId === expectedTemplateId, 'data.templateId must be normalized');
  assert(data.chainId === 11155111, 'data.chainId must be normalized');
  assert(data.network === 'sepolia', 'data.network must be normalized');
  assert(data.parameters && typeof data.parameters === 'object', 'data.parameters must exist');
  assert(Array.isArray(data.actions), 'data.actions must be normalized');
  assert(Array.isArray(data.runtimePlaceholderValues), 'runtime placeholders must be normalized');
  assert(Array.isArray(data.contracts), 'data.contracts must be normalized');
  assert(Array.isArray(data.unsupportedOperations), 'unsupportedOperations must be normalized');
  assert(
    (data.unsupportedOperations as string[]).includes('keeperhub-deploy'),
    'unsupportedOperations must block KeeperHub deploy',
  );
  assert(data.safety && typeof data.safety === 'object', 'data.safety must be normalized');
  assert(
    JSON.stringify(data.parameters) === JSON.stringify(draft.parameters),
    'normalized parameters must match workflowDraft',
  );
  assert(
    JSON.stringify(data.actions) === JSON.stringify(draft.actions),
    'normalized actions must match workflowDraft',
  );
  assertAxlFlowMetadata('CREATE_WORKFLOW_DEMO', data);
  assertOnchainPublishDraft(
    'CREATE_WORKFLOW_DEMO',
    data.onchainPublishDraft as OnchainPublishDraftSummary,
  );
  assertAxlEnvelopeDraft('CREATE_WORKFLOW_DEMO', data.axlEnvelopeDraft as AxlEnvelopeDraftSummary);
}

function assertMarketplaceTemplateFields(template: TemplateSummary, label: string): void {
  const record = template as Record<string, unknown>;

  for (const field of marketplaceTemplateFields) {
    assert(field in record, `${label} must preserve marketplace field ${field}`);
  }

  assert(typeof template.id === 'string', `${label}.id must be a string`);
  assert(typeof template.name === 'string', `${label}.name must be a string`);
  assert(typeof template.description === 'string', `${label}.description must be a string`);
  assert(typeof template.protocol === 'string', `${label}.protocol must be a string`);
  assert(typeof template.category === 'string', `${label}.category must be a string`);
  assert(Array.isArray(template.parameters), `${label}.parameters must be an array`);
  assert(template.trigger && typeof template.trigger === 'object', `${label}.trigger must exist`);
  assert(Array.isArray(template.actions), `${label}.actions must be an array`);
}

function assertTemplateRegistryPreservesSchemaContract(): void {
  for (const template of templateRegistry) {
    templateSchema.parse(template);
    assertMarketplaceTemplateFields(template, template.id);
    assert(getTemplateById(template.id) === template, `${template.id} lookup must remain stable`);
    assert(!('sepolia' in template), `${template.id} must not inline Sepolia metadata`);
    assert(!('chainId' in template), `${template.id} must not inline chain metadata`);
    assert(
      !('runtimePlaceholderValues' in template),
      `${template.id} must keep runtime metadata separate`,
    );
  }

  for (const [keyword, expectedTemplateId] of [
    ['aave', 'aave-recurring-deposit'],
    ['uniswap', 'uniswap-dca'],
    ['lido', 'lido-stake'],
  ] as const) {
    assert(
      findTemplatesByKeyword(keyword).some((template) => template.id === expectedTemplateId),
      `${keyword} keyword lookup must still include ${expectedTemplateId}`,
    );
  }
}

function assertTemplateIds(templates: TemplateSummary[], expectedIds: string[]): void {
  const ids = templates.map((template) => template.id);

  for (const expectedId of expectedIds) {
    assert(ids.includes(expectedId), `template response must include ${expectedId}`);
  }
}

function assertDryRunTemplates(templates: TemplateSummary[]): void {
  for (const template of templates) {
    assert(
      template.sepolia?.executionMode === 'dry-run-only',
      `${template.id} must include sepolia.executionMode=dry-run-only`,
    );
  }
}

function assertLidoMockContracts(template: TemplateSummary): void {
  const serialized = JSON.stringify(template);

  for (const expected of [
    'MockLido',
    'MockStETH',
    'MockWstETH',
    '0x800AB7B237F8Bf9639c0E9127756a5b9049D0C73',
    '0xE1264e5AADb69A27bE594aaafc502D654FFbaC97',
    '0x657e385278B022Bd4cCC980C71fe9Feb3Ea60f08',
  ]) {
    assert(serialized.includes(expected), `Lido response must include ${expected}`);
  }
}

export async function runElizaOsRuntimeSmokeTest(): Promise<RuntimeSmokeResult> {
  assert(loomPlugin.name === 'loomlabs', 'plugin name must remain loomlabs');
  assert(Array.isArray(loomPlugin.actions), 'plugin actions must be an array');

  const phase1 = await runPhase1ElizaOsSmokeTests();
  const actionNames: string[] = [];
  const integrationCases: string[] = [];

  for (const action of loomPlugin.actions) {
    actionNames.push(action.name);
    assert(typeof action.validate === 'function', `${action.name} must expose validate`);
    assert(typeof action.handler === 'function', `${action.name} must expose handler`);
    assert(
      await action.validate(mockRuntime, mockMessage('templateId=lido-stake')),
      `${action.name} validate must pass for dry-run smoke input`,
    );

    const result = await action.handler(
      mockRuntime,
      mockMessage('templateId=lido-stake'),
      undefined,
      undefined,
      undefined,
      [],
    );

    assertActionResult(action.name, result);
    assertDryRunSafety(action.name, result);
  }

  assert(loomPlugin.safety.blockedExternalCalls.includes('keeperhub-deploy'), 'must block deploy');
  assert(loomPlugin.safety.blockedExternalCalls.includes('llm-api-call'), 'must block LLM calls');
  assert(loomPlugin.safety.blockedExternalCalls.includes('apps-api-call'), 'must block API calls');
  assert(loomPlugin.safety.forbiddenRuntimeRequirements.includes('apiKey'), 'must forbid API keys');

  const browseTemplatesAction = loomPlugin.actions.find(
    (action) => action.name === 'BROWSE_TEMPLATES',
  );
  const browseMarketplaceAction = loomPlugin.actions.find(
    (action) => action.name === 'BROWSE_MARKETPLACE',
  );
  const describeTemplateAction = loomPlugin.actions.find(
    (action) => action.name === 'DESCRIBE_TEMPLATE',
  );
  const demoAction = loomPlugin.actions.find((action) => action.name === 'CREATE_WORKFLOW_DEMO');

  assert(browseTemplatesAction, 'BROWSE_TEMPLATES action must exist');
  assert(browseMarketplaceAction, 'BROWSE_MARKETPLACE action must exist');
  assert(describeTemplateAction, 'DESCRIBE_TEMPLATE action must exist');
  assert(demoAction, 'CREATE_WORKFLOW_DEMO action must exist');

  assertTemplateRegistryPreservesSchemaContract();
  integrationCases.push('Template registry preserves marketplace/schema fields');

  const marketplaceResult = await browseMarketplaceAction.handler(
    mockRuntime,
    mockMessage('Browse marketplace templates'),
  );
  assertActionResult('BROWSE_MARKETPLACE integration', marketplaceResult);
  assertDryRunSafety('BROWSE_MARKETPLACE integration', marketplaceResult);
  assertAxlFlowMetadata('BROWSE_MARKETPLACE integration', getDataRecord(marketplaceResult));

  const marketplaceItems = getMarketplaceItems(marketplaceResult);
  assertTemplateIds(
    marketplaceItems.map((item) => {
      assert(item.template, `${item.id} must expose a template summary`);
      return item.template;
    }),
    ['aave-recurring-deposit', 'uniswap-dca', 'lido-stake'],
  );

  for (const item of marketplaceItems) {
    assert(item.source === 'local-demo-registry', `${item.id} must come from local demo registry`);
    assert(item.pricing?.type === 'free', `${item.id} must remain free in the demo registry`);
    assert(item.template, `${item.id} must expose template data`);
    assertMarketplaceTemplateFields(item.template, item.id);
    assert(item.registryHints, `${item.id} must expose registry hints`);
    assert(item.onchainPublishDraft, `${item.id} must expose publish draft`);
    assert(item.axlEnvelopeDraft, `${item.id} must expose AXL envelope draft`);
    assertOnchainPublishDraft(item.id, item.onchainPublishDraft);
    assertAxlEnvelopeDraft(item.id, item.axlEnvelopeDraft);
  }

  integrationCases.push('BROWSE_MARKETPLACE exposes marketplace-safe template fields');

  const browseResult = await browseTemplatesAction.handler(
    mockRuntime,
    mockMessage('Browse available DeFi templates'),
  );
  assertActionResult('BROWSE_TEMPLATES integration', browseResult);
  assertDryRunSafety('BROWSE_TEMPLATES integration', browseResult);

  const browsedTemplates = getTemplates(browseResult);
  assertTemplateIds(browsedTemplates, ['aave-recurring-deposit', 'uniswap-dca', 'lido-stake']);
  assertDryRunTemplates(browsedTemplates);
  assertLidoMockContracts(
    browsedTemplates.find((template) => template.id === 'lido-stake') as TemplateSummary,
  );
  integrationCases.push('BROWSE_TEMPLATES exposes all dry-run Sepolia templates');

  for (const templateId of ['aave-recurring-deposit', 'uniswap-dca', 'lido-stake']) {
    const result = await describeTemplateAction.handler(
      mockRuntime,
      mockMessage(`templateId=${templateId}`),
    );
    assertActionResult(`DESCRIBE_TEMPLATE ${templateId}`, result);
    assertDryRunSafety(`DESCRIBE_TEMPLATE ${templateId}`, result);

    const template = getDescribedTemplate(result);
    assert(template.id === templateId, `DESCRIBE_TEMPLATE must return ${templateId}`);
    assertDryRunTemplates([template]);

    if (templateId === 'lido-stake') {
      assertLidoMockContracts(template);
    }

    integrationCases.push(`DESCRIBE_TEMPLATE returns ${templateId}`);
  }

  const intentCases: Array<[string, string]> = [
    ['deposit DAI to Aave', 'aave-recurring-deposit'],
    ['DCA USDC to WETH', 'uniswap-dca'],
    ['stake ETH with Lido', 'lido-stake'],
  ];

  for (const [prompt, expectedTemplateId] of intentCases) {
    const result = await demoAction.handler(mockRuntime, mockMessage(prompt));
    assertActionResult(`CREATE_WORKFLOW_DEMO ${expectedTemplateId}`, result);
    assertDryRunSafety(`CREATE_WORKFLOW_DEMO ${expectedTemplateId}`, result);
    assert(
      getCandidateIds(result).includes(expectedTemplateId),
      `${prompt} must include ${expectedTemplateId}`,
    );
    assertDryRunWorkflowDraft(result, expectedTemplateId);
    assertDemoResponseQuality(result, expectedTemplateId);
    integrationCases.push(`CREATE_WORKFLOW_DEMO maps "${prompt}"`);
  }

  const runtimeLoading = await runElizaOsRuntimeLoadingTest();
  integrationCases.push(...runtimeLoading.runtimeCases);

  return {
    actionNames,
    integrationCases,
    runtimeLoading,
    phase1Passed: phase1.passed.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runElizaOsRuntimeSmokeTest();

  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}
