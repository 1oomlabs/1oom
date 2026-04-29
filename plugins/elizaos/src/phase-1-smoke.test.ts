import type { IAgentRuntime, Memory } from '@elizaos/core';

import loomPlugin from './index';
import type { LoomAction } from './index';

type SmokeTestCase = {
  name: string;
  expectedFailure?: string;
  run: () => void | Promise<void>;
};

type SmokeTestRunResult = {
  passed: string[];
  expectedFailures: string[];
  skippedExpectedFailures: string[];
};

const expectedCurrentActions = ['CREATE_WORKFLOW', 'BROWSE_MARKETPLACE'];
const expectedDemoActions = ['BROWSE_TEMPLATES', 'DESCRIBE_TEMPLATE', 'CREATE_WORKFLOW_DEMO'];
const expectedDryRunActionNames = [...expectedDemoActions, 'CREATE_WORKFLOW'];
const forbiddenExecutionTerms = [
  'executeTransaction',
  'sendTransaction',
  'signTransaction',
  'broadcastTransaction',
  'deployWorkflow',
  'keeperhubClient',
  'fetch(',
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getActionNames(actions: LoomAction[]): string[] {
  return actions.map((action) => action.name);
}

const mockRuntime = {} as IAgentRuntime;

function mockMessage(text: string): Memory {
  return {
    entityId: '00000000-0000-0000-0000-000000000001',
    roomId: '00000000-0000-0000-0000-000000000002',
    content: {
      text,
      source: 'smoke-test',
    },
  } as Memory;
}

export const phase1ElizaOsSmokeTests: SmokeTestCase[] = [
  {
    name: 'loom plugin keeps the existing loose ElizaOS action surface intact',
    run: () => {
      assert(loomPlugin.name === 'loomlabs', 'plugin name must remain loomlabs');
      assert(Array.isArray(loomPlugin.actions), 'plugin actions must be an array');

      const actionNames = getActionNames(loomPlugin.actions);
      for (const actionName of expectedCurrentActions) {
        assert(
          actionNames.includes(actionName),
          `existing action ${actionName} must remain exported`,
        );
      }
    },
  },
  {
    name: 'exported actions have descriptions and async handlers',
    run: () => {
      for (const action of loomPlugin.actions) {
        assert(action.description.length > 0, `${action.name} must have a description`);
        assert(typeof action.validate === 'function', `${action.name} must have a validate`);
        assert(typeof action.handler === 'function', `${action.name} must have a handler`);
      }
    },
  },
  {
    name: 'demo-safe template browsing and describe actions are expected',
    run: () => {
      const actionNames = getActionNames(loomPlugin.actions);
      for (const actionName of expectedDemoActions) {
        assert(actionNames.includes(actionName), `missing ${actionName}`);
      }
    },
  },
  {
    name: 'ElizaOS runtime compatibility remains marked as INTEGRATION_RISK',
    run: () => {
      assert(
        loomPlugin.integrationRisk === 'INTEGRATION_RISK',
        'plugin must expose INTEGRATION_RISK marker',
      );
    },
  },
  {
    name: 'demo workflow creation returns dry-run data only and cannot execute transactions',
    run: async () => {
      for (const actionName of expectedDryRunActionNames) {
        const action = loomPlugin.actions.find((candidate) => candidate.name === actionName);

        assert(action, `${actionName} must exist`);

        const response = await action.handler(
          mockRuntime,
          mockMessage('Create a demo Aave deposit workflow'),
        );
        const serializedResponse = JSON.stringify(response);

        assert(response?.success === true, `${actionName} must return a successful ActionResult`);
        assert(
          serializedResponse.includes('dry-run-only'),
          `${actionName} must return a dry-run-only payload`,
        );
        assert(
          !serializedResponse.includes('privateKey'),
          `${actionName} must not expose private keys`,
        );
        assert(!serializedResponse.includes('rpcUrl'), `${actionName} must not require RPC`);
        assert(
          !serializedResponse.includes('transactionHash'),
          `${actionName} must not execute transactions`,
        );
      }
    },
  },
  {
    name: 'dry-run actions work without runtime signer or RPC objects',
    run: async () => {
      const hostileRuntime = {
        signer: {
          sendTransaction: () => {
            throw new Error('signer must not be used');
          },
        },
        rpcUrl: 'https://example.invalid',
        wallet: {
          signTransaction: () => {
            throw new Error('wallet must not be used');
          },
        },
      };

      for (const actionName of expectedDryRunActionNames) {
        const action = loomPlugin.actions.find((candidate) => candidate.name === actionName);

        assert(action, `${actionName} must exist`);

        const response = await action.handler(
          hostileRuntime as unknown as IAgentRuntime,
          mockMessage('templateId=lido-stake'),
        );
        const serializedResponse = JSON.stringify(response);

        assert(response?.success === true, `${actionName} must return a successful ActionResult`);
        assert(
          serializedResponse.includes('dry-run-only'),
          `${actionName} must stay dry-run without runtime credentials`,
        );
      }
    },
  },
  {
    name: 'confirmed Lido mock metadata stays dry-run and blocks real execution',
    run: async () => {
      const describeAction = loomPlugin.actions.find(
        (action) => action.name === 'DESCRIBE_TEMPLATE',
      );
      const demoAction = loomPlugin.actions.find(
        (action) => action.name === 'CREATE_WORKFLOW_DEMO',
      );

      assert(describeAction, 'DESCRIBE_TEMPLATE must exist');
      assert(demoAction, 'CREATE_WORKFLOW_DEMO must exist');

      const describeResponse = await describeAction.handler(
        mockRuntime,
        mockMessage('templateId=lido-stake'),
      );
      const demoResponse = await demoAction.handler(
        mockRuntime,
        mockMessage('Please stake ETH with Lido'),
      );

      const combinedResponse = JSON.stringify([describeResponse, demoResponse]);

      assert(describeResponse?.success === true, 'describe action must return ActionResult');
      assert(demoResponse?.success === true, 'demo action must return ActionResult');
      assert(
        combinedResponse.includes('HUMAN_CONFIRMED'),
        'Lido demo response must expose confirmed mock metadata',
      );
      assert(
        combinedResponse.includes('0x800AB7B237F8Bf9639c0E9127756a5b9049D0C73'),
        'Lido demo response must include the confirmed MockLido address',
      );
      assert(
        combinedResponse.includes('0x657e385278B022Bd4cCC980C71fe9Feb3Ea60f08'),
        'Lido demo response must include the confirmed MockWstETH address',
      );
      assert(
        combinedResponse.includes('real-transaction-execution'),
        'Lido demo response must keep real execution blocked',
      );
      assert(
        !combinedResponse.includes('transactionHash'),
        'Lido response must not include tx hash',
      );
    },
  },
  {
    name: 'plugin source exposes no production execution escape hatch',
    run: () => {
      for (const term of forbiddenExecutionTerms) {
        assert(
          !loomPlugin.safety.noProductionExecutionTerms.includes(term),
          `${term} must be blocked`,
        );
      }

      assert(
        loomPlugin.safety.forbiddenRuntimeRequirements.includes('signer'),
        'safety metadata must forbid signer',
      );
      assert(
        loomPlugin.safety.forbiddenRuntimeRequirements.includes('rpcUrl'),
        'safety metadata must forbid RPC',
      );
      assert(
        loomPlugin.safety.forbiddenRuntimeRequirements.includes('privateKey'),
        'safety metadata must forbid private keys',
      );
    },
  },
];

export async function runPhase1ElizaOsSmokeTests(
  options: { includeExpectedFailures?: boolean } = {},
): Promise<SmokeTestRunResult> {
  const result: SmokeTestRunResult = {
    passed: [],
    expectedFailures: [],
    skippedExpectedFailures: [],
  };

  for (const testCase of phase1ElizaOsSmokeTests) {
    if (testCase.expectedFailure && !options.includeExpectedFailures) {
      result.skippedExpectedFailures.push(testCase.name);
      continue;
    }

    try {
      await testCase.run();
      result.passed.push(testCase.name);
    } catch (error) {
      if (!testCase.expectedFailure) {
        throw error;
      }

      result.expectedFailures.push(`${testCase.name}: ${testCase.expectedFailure}`);
    }
  }

  return result;
}
