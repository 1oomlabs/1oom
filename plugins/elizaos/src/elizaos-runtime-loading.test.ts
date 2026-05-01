import {
  type Action,
  type ActionResult,
  AgentRuntime,
  InMemoryDatabaseAdapter,
  type Memory,
  type Project,
  type ProjectAgent,
} from '@elizaos/core';

import loomPlugin from './index';

declare const console: {
  error: (message?: unknown, ...optionalParams: unknown[]) => void;
  log: (message?: unknown, ...optionalParams: unknown[]) => void;
};

declare const process: {
  argv: string[];
  exit: (code?: number) => never;
};

declare global {
  interface ImportMeta {
    url: string;
  }
}

type RuntimeLoadingResult = {
  loadedPlugins: string[];
  discoveredActions: string[];
  runtimeCases: string[];
  externalFetchCalls: number;
};

type DryRunDataRecord = Record<string, unknown>;

const expectedActionNames = [
  'CREATE_WORKFLOW',
  'BROWSE_MARKETPLACE',
  'BROWSE_TEMPLATES',
  'DESCRIBE_TEMPLATE',
  'CREATE_WORKFLOW_DEMO',
  'CHECK_AXL_NODE',
  'SEND_AXL_WORKFLOW_DRAFT',
  'RECEIVE_AXL_MESSAGES',
  'EXECUTE_RECEIVED_AXL_WORKFLOW',
  'CREATE_WORKFLOW_LIVE',
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createBlockedFetchProbe() {
  let calls = 0;

  return {
    get calls() {
      return calls;
    },
    fetch: (..._args: unknown[]) => {
      calls += 1;
      throw new Error('ElizaOS dry-run runtime fixture must not call external fetch.');
    },
  };
}

function mockMessage(text: string): Memory {
  return {
    entityId: '00000000-0000-0000-0000-000000000011',
    roomId: '00000000-0000-0000-0000-000000000012',
    content: {
      text,
      source: 'elizaos-runtime-loading-test',
    },
  } as Memory;
}

function createDryRunProjectFixture(): Project {
  return {
    agents: [
      {
        character: {
          name: 'Loomlabs Dry-run Agent',
          settings: {
            CHECK_SHOULD_RESPOND: false,
            ACTION_PLANNING: false,
          },
        },
        plugins: [loomPlugin],
      },
    ],
  };
}

function createRuntime(
  projectAgent: ProjectAgent,
  fetchProbe: ReturnType<typeof createBlockedFetchProbe>,
) {
  return new AgentRuntime({
    agentId: '00000000-0000-0000-0000-000000000010',
    character: projectAgent.character,
    plugins: projectAgent.plugins ?? [],
    adapter: new InMemoryDatabaseAdapter(),
    disableBasicCapabilities: true,
    actionPlanning: false,
    checkShouldRespond: false,
    logLevel: 'error',
    fetch: fetchProbe.fetch as never,
  });
}

function getAction(runtime: AgentRuntime, actionName: string): Action {
  const action = runtime.getAllActions().find((candidate) => candidate.name === actionName);

  assert(action, `ElizaOS runtime must discover action ${actionName}`);
  return action;
}

async function runAction(
  runtime: AgentRuntime,
  actionName: string,
  text: string,
): Promise<ActionResult | undefined> {
  const action = getAction(runtime, actionName);
  const message = mockMessage(text);

  assert(
    await action.validate(runtime, message),
    `ElizaOS runtime action ${actionName} must validate dry-run input`,
  );

  return action.handler(runtime, message);
}

function getData(result: ActionResult | undefined, label: string): DryRunDataRecord {
  assert(result?.success === true, `${label} must return success=true`);
  assert(typeof result.text === 'string', `${label} must return text`);
  assert(result.data && typeof result.data === 'object', `${label} must return data`);

  return result.data as DryRunDataRecord;
}

function assertDryRunBoundary(result: ActionResult | undefined, label: string): DryRunDataRecord {
  const data = getData(result, label);
  const safety = data.safety as DryRunDataRecord | undefined;
  const serialized = JSON.stringify(result);

  assert(data.executionMode === 'dry-run-only', `${label} must stay dry-run-only`);
  assert(
    data.integrationRisk === 'INTEGRATION_RISK',
    `${label} must keep runtime integration risk explicit`,
  );
  assert(safety, `${label} must include safety metadata`);
  assert(safety.callsKeeperHub === false, `${label} must not call KeeperHub`);
  assert(safety.callsExternalLlm === false, `${label} must not call external LLMs`);
  assert(safety.callsAppApi === false, `${label} must not call app APIs`);
  assert(safety.requiresSigner === false, `${label} must not require signer`);
  assert(safety.requiresRpc === false, `${label} must not require RPC`);
  assert(safety.requiresApiKey === false, `${label} must not require API keys`);
  assert(!serialized.includes('privateKey'), `${label} must not expose private keys`);
  assert(!serialized.includes('transactionHash'), `${label} must not expose transaction hashes`);

  return data;
}

function assertTemplateIds(data: DryRunDataRecord, label: string): void {
  const templates = data.templates;

  assert(Array.isArray(templates), `${label} must return templates`);

  const ids = templates.map((template) => (template as { id?: string }).id);

  for (const expected of ['aave-recurring-deposit', 'uniswap-dca', 'lido-stake']) {
    assert(ids.includes(expected), `${label} must include ${expected}`);
  }
}

function assertDescribedLido(data: DryRunDataRecord): void {
  const template = data.template as { id?: string; sepolia?: unknown } | undefined;

  assert(template?.id === 'lido-stake', 'DESCRIBE_TEMPLATE must describe lido-stake');
  assert(template.sepolia, 'DESCRIBE_TEMPLATE must include Sepolia metadata');
}

function assertLidoWorkflowDraft(data: DryRunDataRecord): void {
  const workflowDraft = data.workflowDraft as
    | {
        templateId?: string;
        executionMode?: string;
        deployStatus?: string;
        deployBlockedBy?: string[];
      }
    | undefined;

  assert(workflowDraft, 'CREATE_WORKFLOW_DEMO must include workflowDraft');
  assert(workflowDraft.templateId === 'lido-stake', 'workflowDraft must select lido-stake');
  assert(workflowDraft.executionMode === 'dry-run-only', 'workflowDraft must stay dry-run-only');
  assert(
    workflowDraft.deployStatus === 'dry-run-not-submitted',
    'workflowDraft must not be submitted',
  );
  assert(
    workflowDraft.deployBlockedBy?.includes('real-transaction-execution'),
    'workflowDraft must block real transaction execution',
  );
}

export async function runElizaOsRuntimeLoadingTest(): Promise<RuntimeLoadingResult> {
  const project = createDryRunProjectFixture();
  const projectAgent = project.agents[0];
  const fetchProbe = createBlockedFetchProbe();

  assert(projectAgent, 'ElizaOS project fixture must define one agent');
  assert(
    projectAgent.plugins?.some((plugin) => plugin.name === 'loomlabs'),
    'ElizaOS project fixture must register loomlabs plugin',
  );

  const runtime = createRuntime(projectAgent, fetchProbe);

  try {
    await runtime.initialize({ skipMigrations: true });

    const loadedPlugins = runtime.plugins.map((plugin) => plugin.name);
    const discoveredActions = runtime.getAllActions().map((action) => action.name);
    const runtimeCases: string[] = [];

    assert(loadedPlugins.includes('loomlabs'), 'ElizaOS runtime must load loomlabs plugin');

    for (const actionName of expectedActionNames) {
      assert(discoveredActions.includes(actionName), `ElizaOS runtime must discover ${actionName}`);
    }

    runtimeCases.push('ElizaOS AgentRuntime loads loomlabs plugin');
    runtimeCases.push('ElizaOS AgentRuntime discovers Loomlabs actions');

    const browseResult = await runAction(
      runtime,
      'BROWSE_TEMPLATES',
      'Browse available DeFi templates',
    );
    assertTemplateIds(assertDryRunBoundary(browseResult, 'BROWSE_TEMPLATES'), 'BROWSE_TEMPLATES');
    runtimeCases.push('BROWSE_TEMPLATES runs through actual AgentRuntime');

    const describeResult = await runAction(runtime, 'DESCRIBE_TEMPLATE', 'templateId=lido-stake');
    assertDescribedLido(assertDryRunBoundary(describeResult, 'DESCRIBE_TEMPLATE'));
    runtimeCases.push('DESCRIBE_TEMPLATE runs through actual AgentRuntime');

    const demoResult = await runAction(
      runtime,
      'CREATE_WORKFLOW_DEMO',
      'Create a demo workflow to stake ETH with Lido',
    );
    assertLidoWorkflowDraft(assertDryRunBoundary(demoResult, 'CREATE_WORKFLOW_DEMO'));
    runtimeCases.push('CREATE_WORKFLOW_DEMO runs through actual AgentRuntime');

    assert(fetchProbe.calls === 0, 'ElizaOS runtime dry-run actions must not call external fetch');
    runtimeCases.push('Actual runtime fixture made zero external fetch calls');

    return {
      loadedPlugins,
      discoveredActions,
      runtimeCases,
      externalFetchCalls: fetchProbe.calls,
    };
  } finally {
    await runtime.stop();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runElizaOsRuntimeLoadingTest()
    .then((result) => {
      console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
