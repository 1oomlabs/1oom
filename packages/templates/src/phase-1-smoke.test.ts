import { templateSchema } from '@loomlabs/schema';

import {
  DRY_RUN_ONLY,
  HUMAN_CONFIRMED,
  NEEDS_HUMAN_CONFIRMATION,
  SEPOLIA_CHAIN_ID,
  TEMPLATE_VALIDATION_ISSUE_CODES,
  findTemplatesByKeyword,
  getSepoliaTemplateMetadata,
  getTemplateById,
  sepoliaTemplateMetadata,
  templates,
  validateTemplatesForSepolia,
} from './index';
import type { SepoliaTemplateMetadata } from './sepolia-metadata';

type SmokeTestCase = {
  name: string;
  expectedFailure?: string;
  run: () => void;
};

type SmokeTestRunResult = {
  passed: string[];
  expectedFailures: string[];
  skippedExpectedFailures: string[];
};

const expectedTemplateIds = ['aave-recurring-deposit', 'uniswap-dca', 'lido-stake'];
const allowedRuntimePlaceholders = new Set([
  '$AAVE_POOL',
  '$UNISWAP_ROUTER',
  '$MOCK_WSTETH',
  '$user',
]);
const templatesWithResolvedProtocolData = new Set([
  'aave-recurring-deposit',
  'uniswap-dca',
  'lido-stake',
]);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSameMembers(actual: string[], expected: string[], label: string): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  assert(actualSet.size === expectedSet.size, `${label}: expected ${expected.length} items`);

  for (const item of expectedSet) {
    assert(actualSet.has(item), `${label}: missing ${item}`);
  }
}

function collectActionPlaceholders(args: string[]): string[] {
  return args.filter((arg) => arg.startsWith('$'));
}

function findDemoParameter(templateId: string, name: string): string | number | boolean {
  const metadata = getSepoliaTemplateMetadata(templateId);
  const parameter = metadata?.demoParameters.find((candidate) => candidate.name === name);

  assert(parameter, `${templateId} must define ${name} demo parameter`);
  return parameter.value;
}

export const phase1TemplateSmokeTests: SmokeTestCase[] = [
  {
    name: 'template registry exposes the three Person C templates',
    run: () => {
      assertSameMembers(
        templates.map((template) => template.id),
        expectedTemplateIds,
        'template registry',
      );
    },
  },
  {
    name: 'registered templates satisfy the shared template schema',
    run: () => {
      for (const template of templates) {
        templateSchema.parse(template);
      }
    },
  },
  {
    name: 'template ids are unique and individually discoverable',
    run: () => {
      const ids = templates.map((template) => template.id);
      assert(new Set(ids).size === ids.length, 'template ids must be unique');

      for (const id of expectedTemplateIds) {
        assert(getTemplateById(id)?.id === id, `getTemplateById must find ${id}`);
      }
    },
  },
  {
    name: 'keyword search covers aave, uniswap, and lido templates',
    run: () => {
      const keywordCases: Array<[string, string]> = [
        ['aave', 'aave-recurring-deposit'],
        ['uniswap', 'uniswap-dca'],
        ['lido', 'lido-stake'],
      ];

      for (const [keyword, expectedId] of keywordCases) {
        const foundIds = findTemplatesByKeyword(keyword).map((template) => template.id);
        assert(foundIds.includes(expectedId), `${keyword} search must include ${expectedId}`);
      }
    },
  },
  {
    name: 'action placeholders are declared parameters or approved runtime placeholders',
    run: () => {
      for (const template of templates) {
        const parameterPlaceholders = new Set(
          template.parameters.map((parameter) => `$${parameter.name}`),
        );

        for (const action of template.actions) {
          for (const placeholder of collectActionPlaceholders(action.args)) {
            assert(
              parameterPlaceholders.has(placeholder) || allowedRuntimePlaceholders.has(placeholder),
              `${template.id}.${action.method} uses undeclared placeholder ${placeholder}`,
            );
          }
        }
      }
    },
  },
  {
    name: 'Sepolia metadata coverage exists for every public template',
    run: () => {
      assertSameMembers(
        Object.keys(sepoliaTemplateMetadata),
        expectedTemplateIds,
        'Sepolia metadata coverage',
      );

      for (const templateId of expectedTemplateIds) {
        const metadata = getSepoliaTemplateMetadata(templateId);

        assert(metadata, `Sepolia metadata must exist for ${templateId}`);
        assert(metadata.templateId === templateId, `${templateId} metadata id must match`);
        assert(metadata.chainId === SEPOLIA_CHAIN_ID, `${templateId} must target Sepolia`);
        assert(metadata.executionMode === DRY_RUN_ONLY, `${templateId} must be dry-run only`);
        assert(metadata.demoOnly, `${templateId} metadata must be demo-only`);

        if (templatesWithResolvedProtocolData.has(templateId)) {
          assert(
            !metadata.requiresHumanConfirmation,
            `${templateId} protocol data must be human-confirmation resolved`,
          );
        } else {
          assert(
            metadata.requiresHumanConfirmation,
            `${templateId} must still require human confirmation`,
          );
        }
      }
    },
  },
  {
    name: 'confirmed protocol values are resolved while unresolved addresses remain human-gated',
    run: () => {
      for (const metadata of Object.values(sepoliaTemplateMetadata)) {
        const isResolved = templatesWithResolvedProtocolData.has(metadata.templateId);

        if (isResolved) {
          assert(
            metadata.unresolvedHumanConfirmations.length === 0,
            `${metadata.templateId} must not expose resolved values as unresolved`,
          );
        } else {
          assert(
            metadata.unresolvedHumanConfirmations.length > 0,
            `${metadata.templateId} must expose unresolved confirmations`,
          );
        }

        for (const contract of metadata.contracts) {
          if (isResolved) {
            assert(
              contract.abi.status === HUMAN_CONFIRMED,
              `${metadata.templateId}.${contract.contract} ABI must be human confirmed`,
            );
          }

          if (
            contract.address.kind === 'protocol-address' ||
            contract.address.kind === 'mock-address'
          ) {
            if (isResolved) {
              assert(
                contract.address.confirmation === HUMAN_CONFIRMED,
                `${metadata.templateId}.${contract.contract} address must be human confirmed`,
              );
            } else {
              assert(
                contract.address.value === NEEDS_HUMAN_CONFIRMATION,
                `${metadata.templateId}.${contract.contract} address must remain unresolved`,
              );
            }
          }
        }
      }
    },
  },
  {
    name: 'Lido stake uses confirmed Sepolia mock addresses and mock ABI',
    run: () => {
      const lidoMetadata = getSepoliaTemplateMetadata('lido-stake');
      const lidoTemplate = getTemplateById('lido-stake');

      assert(lidoMetadata, 'Lido metadata must exist');
      assert(lidoTemplate, 'Lido template must exist');
      assert(!lidoMetadata.requiresHumanConfirmation, 'Lido mock addresses must be resolved');
      assert(
        lidoMetadata.unresolvedHumanConfirmations.length === 0,
        'Lido unresolved confirmations must be cleared',
      );
      assert(
        lidoMetadata.runtimePlaceholderValues.some(
          (entry) =>
            entry.placeholder === '$MOCK_WSTETH' &&
            entry.value === '0x657e385278B022Bd4cCC980C71fe9Feb3Ea60f08',
        ),
        'Lido metadata must resolve $MOCK_WSTETH',
      );

      assertSameMembers(
        lidoMetadata.contracts.map((contract) => contract.contract),
        ['MockLido', 'MockStETH', 'MockWstETH'],
        'Lido mock contracts',
      );

      for (const contract of lidoMetadata.contracts) {
        assert(
          contract.address.kind === 'mock-address',
          `${contract.contract} must use mock-address metadata`,
        );
        assert(
          contract.address.confirmation === HUMAN_CONFIRMED,
          `${contract.contract} mock address must be human confirmed`,
        );
        assert(
          contract.abi.status === HUMAN_CONFIRMED,
          `${contract.contract} mock ABI must be human-confirmed demo ABI`,
        );

        for (const method of contract.requiredMethods) {
          assert(
            contract.abi.fragments.some((fragment) => fragment.name === method),
            `${contract.contract} must expose ${method} ABI fragment`,
          );
        }
      }

      assert(
        lidoTemplate.actions.some(
          (action) => action.contract === 'MockLido' && action.method === 'submit',
        ),
        'Lido template must submit ETH to MockLido',
      );
      assert(
        lidoTemplate.actions.some(
          (action) =>
            action.contract === 'MockStETH' &&
            action.method === 'approve' &&
            action.args.includes('$MOCK_WSTETH'),
        ),
        'Lido template must approve MockWstETH before wrapping',
      );
      assert(
        lidoTemplate.actions.some(
          (action) => action.contract === 'MockWstETH' && action.method === 'wrap',
        ),
        'Lido template must wrap mock stETH into mock wstETH',
      );
      assert(findDemoParameter('lido-stake', 'stETHDecimals') === 18, 'stETH decimals must be 18');
      assert(
        findDemoParameter('lido-stake', 'wstETHDecimals') === 18,
        'wstETH decimals must be 18',
      );
      assert(
        lidoMetadata.contracts.some(
          (contract) =>
            contract.contract === 'MockLido' &&
            contract.address.kind === 'mock-address' &&
            contract.address.value === '0x800AB7B237F8Bf9639c0E9127756a5b9049D0C73',
        ),
        'Lido metadata must include the confirmed MockLido address',
      );
      assert(
        lidoMetadata.contracts.some(
          (contract) =>
            contract.contract === 'MockStETH' &&
            contract.address.kind === 'mock-address' &&
            contract.address.value === '0xE1264e5AADb69A27bE594aaafc502D654FFbaC97',
        ),
        'Lido metadata must include the confirmed MockStETH address',
      );
    },
  },
  {
    name: 'Aave and Uniswap Sepolia demo defaults are wired to confirmed values',
    run: () => {
      const aaveMetadata = getSepoliaTemplateMetadata('aave-recurring-deposit');
      const uniswapMetadata = getSepoliaTemplateMetadata('uniswap-dca');
      const uniswapTemplate = getTemplateById('uniswap-dca');
      const uniswapSwapAction = uniswapTemplate?.actions.find(
        (action) => action.method === 'exactInputSingle',
      );

      assert(aaveMetadata, 'Aave metadata must exist');
      assert(uniswapMetadata, 'Uniswap metadata must exist');
      assert(uniswapSwapAction, 'Uniswap exactInputSingle action must exist');
      assert(
        aaveMetadata.runtimePlaceholderValues.some(
          (entry) =>
            entry.placeholder === '$AAVE_POOL' &&
            entry.value === '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
        ),
        'Aave metadata must resolve $AAVE_POOL',
      );
      assert(
        findDemoParameter('aave-recurring-deposit', 'token') ===
          '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
        'Aave demo token must be Sepolia DAI',
      );
      assert(
        aaveMetadata.verificationTargets.some(
          (target) => target.value === '0x29598b72eb5CeBd806C5dCD549490FdA35B13cD8',
        ),
        'Aave verification target must include Sepolia aDAI',
      );
      assert(
        uniswapMetadata.runtimePlaceholderValues.some(
          (entry) =>
            entry.placeholder === '$UNISWAP_ROUTER' &&
            entry.value === '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
        ),
        'Uniswap metadata must resolve $UNISWAP_ROUTER',
      );
      assert(
        findDemoParameter('uniswap-dca', 'tokenIn') ===
          '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        'Uniswap tokenIn must be Sepolia USDC',
      );
      assert(
        findDemoParameter('uniswap-dca', 'tokenOut') ===
          '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
        'Uniswap tokenOut must be Sepolia WETH',
      );
      assert(findDemoParameter('uniswap-dca', 'feeTier') === 500, 'fee tier must be 500');
      assert(
        findDemoParameter('uniswap-dca', 'poolAddress') ===
          '0x3289680dd4d6c10bb19b899729cda5eef58aeff1',
        'Uniswap pool must be the confirmed USDC/WETH 0.05% pool',
      );
      assert(
        uniswapSwapAction.args[2] === '500',
        'Uniswap template action must use the confirmed Sepolia fee tier',
      );
    },
  },
  {
    name: 'Sepolia metadata cannot require runtime credentials or real transactions',
    run: () => {
      const forbiddenRuntimeKeys = ['rpcUrl', 'signer', 'wallet', 'privateKey'];
      const serializedMetadata = JSON.stringify(sepoliaTemplateMetadata);

      for (const key of forbiddenRuntimeKeys) {
        assert(!serializedMetadata.includes(`\"${key}\"`), `metadata must not include ${key}`);
      }

      for (const metadata of Object.values(sepoliaTemplateMetadata)) {
        assert(
          metadata.unsupportedOperations.includes('real-transaction-execution'),
          `${metadata.templateId} must explicitly block real transaction execution`,
        );
        assert(
          metadata.unsupportedOperations.includes('signer-required'),
          `${metadata.templateId} must not require a signer`,
        );
      }
    },
  },
  {
    name: 'static validation utility reports the current registry as valid',
    run: () => {
      const result = validateTemplatesForSepolia();

      assert(
        result.ok,
        `expected current Sepolia registry to validate: ${JSON.stringify(result.issues)}`,
      );
    },
  },
  {
    name: 'ABI validation fails missing required method fragments predictably',
    run: () => {
      const aaveMetadata = sepoliaTemplateMetadata['aave-recurring-deposit'];
      const result = validateTemplatesForSepolia({
        metadata: {
          ...sepoliaTemplateMetadata,
          'aave-recurring-deposit': {
            ...aaveMetadata,
            contracts: aaveMetadata.contracts.map((contract) =>
              contract.contract === 'ERC20'
                ? {
                    ...contract,
                    abi: {
                      ...contract.abi,
                      fragments: contract.abi.fragments.filter(
                        (fragment) => fragment.name !== 'approve',
                      ),
                    },
                  }
                : contract,
            ),
          } as unknown as SepoliaTemplateMetadata,
        },
      });

      assert(!result.ok, 'missing approve ABI fragment must fail validation');
      assert(
        result.issues.some(
          (issue) => issue.code === TEMPLATE_VALIDATION_ISSUE_CODES.MISSING_REQUIRED_ABI_FRAGMENT,
        ),
        'missing ABI method must emit MISSING_REQUIRED_ABI_FRAGMENT',
      );
    },
  },
  {
    name: 'ABI validation fails invalid Aave supply argument shape predictably',
    run: () => {
      const aaveMetadata = sepoliaTemplateMetadata['aave-recurring-deposit'];
      const result = validateTemplatesForSepolia({
        metadata: {
          ...sepoliaTemplateMetadata,
          'aave-recurring-deposit': {
            ...aaveMetadata,
            contracts: aaveMetadata.contracts.map((contract) =>
              contract.contract === 'AavePool'
                ? {
                    ...contract,
                    abi: {
                      ...contract.abi,
                      fragments: contract.abi.fragments.map((fragment) =>
                        fragment.name === 'supply'
                          ? {
                              ...fragment,
                              inputs: fragment.inputs.map((input) =>
                                input.name === 'referralCode'
                                  ? { ...input, type: 'uint256' }
                                  : input,
                              ),
                            }
                          : fragment,
                      ),
                    },
                  }
                : contract,
            ),
          } as unknown as SepoliaTemplateMetadata,
        },
      });

      assert(!result.ok, 'invalid supply ABI fragment must fail validation');
      assert(
        result.issues.some(
          (issue) => issue.code === TEMPLATE_VALIDATION_ISSUE_CODES.INVALID_ABI_FRAGMENT,
        ),
        'invalid ABI shape must emit INVALID_ABI_FRAGMENT',
      );
    },
  },
  {
    name: 'ABI validation fails Uniswap exactInputSingle deadline-style params predictably',
    run: () => {
      const uniswapMetadata = sepoliaTemplateMetadata['uniswap-dca'];
      const result = validateTemplatesForSepolia({
        metadata: {
          ...sepoliaTemplateMetadata,
          'uniswap-dca': {
            ...uniswapMetadata,
            contracts: uniswapMetadata.contracts.map((contract) =>
              contract.contract === 'UniswapRouter'
                ? {
                    ...contract,
                    abi: {
                      ...contract.abi,
                      fragments: contract.abi.fragments.map((fragment) =>
                        fragment.name === 'exactInputSingle'
                          ? {
                              ...fragment,
                              inputs: [
                                {
                                  ...fragment.inputs[0],
                                  components: [
                                    ...(fragment.inputs[0]?.components ?? []),
                                    {
                                      internalType: 'uint256',
                                      name: 'deadline',
                                      type: 'uint256',
                                    },
                                  ],
                                },
                              ],
                            }
                          : fragment,
                      ),
                    },
                  }
                : contract,
            ),
          } as unknown as SepoliaTemplateMetadata,
        },
      });

      assert(!result.ok, 'deadline-style exactInputSingle ABI must fail validation');
      assert(
        result.issues.some(
          (issue) => issue.code === TEMPLATE_VALIDATION_ISSUE_CODES.INVALID_ABI_FRAGMENT,
        ),
        'deadline-style exactInputSingle must emit INVALID_ABI_FRAGMENT',
      );
    },
  },
  {
    name: 'static validation utility fails duplicate template ids predictably',
    run: () => {
      const duplicateTemplate = templates[0];

      assert(duplicateTemplate, 'duplicate test requires at least one template');

      const result = validateTemplatesForSepolia({
        templates: [...templates, { ...duplicateTemplate, name: 'Duplicate Aave Template' }],
      });

      assert(!result.ok, 'duplicate template id must fail validation');
      assert(
        result.issues.some(
          (issue) => issue.code === TEMPLATE_VALIDATION_ISSUE_CODES.DUPLICATE_TEMPLATE_ID,
        ),
        'duplicate template id must emit DUPLICATE_TEMPLATE_ID',
      );
    },
  },
  {
    name: 'static validation utility fails missing Sepolia metadata predictably',
    run: () => {
      const metadataWithoutLido = Object.fromEntries(
        Object.entries(sepoliaTemplateMetadata).filter(
          ([templateId]) => templateId !== 'lido-stake',
        ),
      ) as Partial<Record<string, SepoliaTemplateMetadata>>;
      const result = validateTemplatesForSepolia({ metadata: metadataWithoutLido });

      assert(!result.ok, 'missing metadata must fail validation');
      assert(
        result.issues.some(
          (issue) => issue.code === TEMPLATE_VALIDATION_ISSUE_CODES.MISSING_SEPOLIA_METADATA,
        ),
        'missing metadata must emit MISSING_SEPOLIA_METADATA',
      );
    },
  },
  {
    name: 'static validation utility fails undeclared action placeholders predictably',
    run: () => {
      const [firstTemplate, ...remainingTemplates] = templates;
      const firstAction = firstTemplate?.actions[0];

      assert(firstTemplate, 'placeholder test requires at least one template');
      assert(firstAction, 'placeholder test requires at least one action');

      const result = validateTemplatesForSepolia({
        templates: [
          {
            ...firstTemplate,
            actions: [
              {
                ...firstAction,
                args: ['$UNDECLARED_PLACEHOLDER'],
              },
              ...firstTemplate.actions.slice(1),
            ],
          },
          ...remainingTemplates,
        ],
      });

      assert(!result.ok, 'undeclared placeholder must fail validation');
      assert(
        result.issues.some(
          (issue) => issue.code === TEMPLATE_VALIDATION_ISSUE_CODES.UNDECLARED_PLACEHOLDER,
        ),
        'undeclared placeholder must emit UNDECLARED_PLACEHOLDER',
      );
    },
  },
];

export function runPhase1TemplateSmokeTests(
  options: { includeExpectedFailures?: boolean } = {},
): SmokeTestRunResult {
  const result: SmokeTestRunResult = {
    passed: [],
    expectedFailures: [],
    skippedExpectedFailures: [],
  };

  for (const testCase of phase1TemplateSmokeTests) {
    if (testCase.expectedFailure && !options.includeExpectedFailures) {
      result.skippedExpectedFailures.push(testCase.name);
      continue;
    }

    try {
      testCase.run();
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
