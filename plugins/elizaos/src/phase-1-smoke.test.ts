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

        const response = await action.handler(undefined, {
          text: 'Create a demo Aave deposit workflow',
        });
        const serializedResponse = JSON.stringify(response);

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

        const response = await action.handler(hostileRuntime, {
          text: 'templateId=lido-stake',
        });
        const serializedResponse = JSON.stringify(response);

        assert(
          serializedResponse.includes('dry-run-only'),
          `${actionName} must stay dry-run without runtime credentials`,
        );
      }
    },
  },
  {
    name: 'unresolved Lido metadata blocks execution in demo responses',
    run: async () => {
      const describeAction = loomPlugin.actions.find(
        (action) => action.name === 'DESCRIBE_TEMPLATE',
      );
      const demoAction = loomPlugin.actions.find(
        (action) => action.name === 'CREATE_WORKFLOW_DEMO',
      );

      assert(describeAction, 'DESCRIBE_TEMPLATE must exist');
      assert(demoAction, 'CREATE_WORKFLOW_DEMO must exist');

      const describeResponse = await describeAction.handler(undefined, {
        text: 'templateId=lido-stake',
      });
      const demoResponse = await demoAction.handler(undefined, {
        text: 'Please stake ETH with Lido',
      });

      const combinedResponse = JSON.stringify([describeResponse, demoResponse]);

      assert(
        combinedResponse.includes('NEEDS_HUMAN_CONFIRMATION'),
        'Lido demo response must expose unresolved metadata',
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
