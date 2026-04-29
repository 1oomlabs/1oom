import type { ActionResult, IAgentRuntime, Memory } from '@elizaos/core';

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
  phase1Passed: number;
};

type TemplateSummary = {
  id: string;
  sepolia?: {
    executionMode?: string;
    contracts?: Array<{ contract: string; address?: { value?: string } }>;
  };
};

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
  assert(!serialized.includes('transactionHash'), `${actionName} must not return tx hashes`);
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
  }

  const browseTemplatesAction = loomPlugin.actions.find(
    (action) => action.name === 'BROWSE_TEMPLATES',
  );
  const describeTemplateAction = loomPlugin.actions.find(
    (action) => action.name === 'DESCRIBE_TEMPLATE',
  );
  const demoAction = loomPlugin.actions.find((action) => action.name === 'CREATE_WORKFLOW_DEMO');

  assert(browseTemplatesAction, 'BROWSE_TEMPLATES action must exist');
  assert(describeTemplateAction, 'DESCRIBE_TEMPLATE action must exist');
  assert(demoAction, 'CREATE_WORKFLOW_DEMO action must exist');

  const browseResult = await browseTemplatesAction.handler(
    mockRuntime,
    mockMessage('Browse available DeFi templates'),
  );
  assertActionResult('BROWSE_TEMPLATES integration', browseResult);

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
    assert(
      getCandidateIds(result).includes(expectedTemplateId),
      `${prompt} must include ${expectedTemplateId}`,
    );
    integrationCases.push(`CREATE_WORKFLOW_DEMO maps "${prompt}"`);
  }

  return {
    actionNames,
    integrationCases,
    phase1Passed: phase1.passed.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runElizaOsRuntimeSmokeTest();

  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}
