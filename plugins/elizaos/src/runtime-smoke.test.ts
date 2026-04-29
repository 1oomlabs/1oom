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
  phase1Passed: number;
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

export async function runElizaOsRuntimeSmokeTest(): Promise<RuntimeSmokeResult> {
  assert(loomPlugin.name === 'loomlabs', 'plugin name must remain loomlabs');
  assert(Array.isArray(loomPlugin.actions), 'plugin actions must be an array');

  const phase1 = await runPhase1ElizaOsSmokeTests();
  const actionNames: string[] = [];

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

  return {
    actionNames,
    phase1Passed: phase1.passed.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runElizaOsRuntimeSmokeTest();

  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}
