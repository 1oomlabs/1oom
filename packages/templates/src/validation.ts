import { type Template, templateSchema } from '@loomlabs/schema';

import { aaveRecurringDepositTemplate } from './aave-recurring-deposit';
import { lidoStakeTemplate } from './lido-stake';
import {
  DRY_RUN_ONLY,
  HUMAN_CONFIRMED,
  NEEDS_HUMAN_CONFIRMATION,
  SEPOLIA_CHAIN_ID,
  type SepoliaAbiFragment,
  type SepoliaContractMetadata,
  type SepoliaTemplateMetadata,
  sepoliaTemplateMetadata,
} from './sepolia-metadata';
import { uniswapDcaTemplate } from './uniswap-dca';

export const TEMPLATE_VALIDATION_ISSUE_CODES = {
  INVALID_TEMPLATE_SCHEMA: 'INVALID_TEMPLATE_SCHEMA',
  DUPLICATE_TEMPLATE_ID: 'DUPLICATE_TEMPLATE_ID',
  EMPTY_INTENT_KEYWORDS: 'EMPTY_INTENT_KEYWORDS',
  UNDECLARED_PLACEHOLDER: 'UNDECLARED_PLACEHOLDER',
  MISSING_SEPOLIA_METADATA: 'MISSING_SEPOLIA_METADATA',
  ORPHAN_SEPOLIA_METADATA: 'ORPHAN_SEPOLIA_METADATA',
  INVALID_SEPOLIA_METADATA: 'INVALID_SEPOLIA_METADATA',
  MISSING_HUMAN_CONFIRMATION: 'MISSING_HUMAN_CONFIRMATION',
  STALE_HUMAN_CONFIRMATION: 'STALE_HUMAN_CONFIRMATION',
  IMPLICIT_UNRESOLVED_VALUE: 'IMPLICIT_UNRESOLVED_VALUE',
  UNSAFE_OPERATION_NOT_BLOCKED: 'UNSAFE_OPERATION_NOT_BLOCKED',
  MISSING_REQUIRED_ABI_FRAGMENT: 'MISSING_REQUIRED_ABI_FRAGMENT',
  INVALID_ABI_FRAGMENT: 'INVALID_ABI_FRAGMENT',
} as const;

export type TemplateValidationIssueCode =
  (typeof TEMPLATE_VALIDATION_ISSUE_CODES)[keyof typeof TEMPLATE_VALIDATION_ISSUE_CODES];

export type TemplateValidationIssue = {
  code: TemplateValidationIssueCode;
  templateId?: string;
  path?: string;
  message: string;
};

export type TemplateValidationResult = {
  ok: boolean;
  issues: TemplateValidationIssue[];
};

export type SepoliaMetadataMap = Partial<Record<string, SepoliaTemplateMetadata>>;

export type TemplateValidationOptions = {
  templates?: readonly Template[];
  metadata?: SepoliaMetadataMap;
};

const defaultTemplates = [
  aaveRecurringDepositTemplate,
  uniswapDcaTemplate,
  lidoStakeTemplate,
] as const satisfies readonly Template[];

const unsafeOperations = [
  'rpc-call',
  'signer-required',
  'transaction-construction',
  'real-transaction-execution',
] as const;

type AbiFragmentRequirement = {
  inputNames: readonly string[];
  inputTypes: readonly string[];
  outputTypes: readonly string[];
  stateMutability: SepoliaAbiFragment['stateMutability'];
  tupleComponentNames?: readonly string[];
  tupleComponentTypes?: readonly string[];
};

const abiFragmentRequirements: Record<string, AbiFragmentRequirement> = {
  approve: {
    inputNames: ['spender', 'amount'],
    inputTypes: ['address', 'uint256'],
    outputTypes: ['bool'],
    stateMutability: 'nonpayable',
  },
  allowance: {
    inputNames: ['owner', 'spender'],
    inputTypes: ['address', 'address'],
    outputTypes: ['uint256'],
    stateMutability: 'view',
  },
  balanceOf: {
    inputNames: ['account'],
    inputTypes: ['address'],
    outputTypes: ['uint256'],
    stateMutability: 'view',
  },
  decimals: {
    inputNames: [],
    inputTypes: [],
    outputTypes: ['uint8'],
    stateMutability: 'view',
  },
  symbol: {
    inputNames: [],
    inputTypes: [],
    outputTypes: ['string'],
    stateMutability: 'view',
  },
  supply: {
    inputNames: ['asset', 'amount', 'onBehalfOf', 'referralCode'],
    inputTypes: ['address', 'uint256', 'address', 'uint16'],
    outputTypes: [],
    stateMutability: 'nonpayable',
  },
  exactInputSingle: {
    inputNames: ['params'],
    inputTypes: ['tuple'],
    outputTypes: ['uint256'],
    stateMutability: 'payable',
    tupleComponentNames: [
      'tokenIn',
      'tokenOut',
      'fee',
      'recipient',
      'amountIn',
      'amountOutMinimum',
      'sqrtPriceLimitX96',
    ],
    tupleComponentTypes: [
      'address',
      'address',
      'uint24',
      'address',
      'uint256',
      'uint256',
      'uint160',
    ],
  },
  submit: {
    inputNames: ['referral'],
    inputTypes: ['address'],
    outputTypes: ['uint256'],
    stateMutability: 'payable',
  },
  wrap: {
    inputNames: ['stETHAmount'],
    inputTypes: ['uint256'],
    outputTypes: ['uint256'],
    stateMutability: 'nonpayable',
  },
  unwrap: {
    inputNames: ['wstETHAmount'],
    inputTypes: ['uint256'],
    outputTypes: ['uint256'],
    stateMutability: 'nonpayable',
  },
};

function addIssue(issues: TemplateValidationIssue[], issue: TemplateValidationIssue): void {
  issues.push(issue);
}

function collectActionPlaceholders(args: readonly string[]): string[] {
  return args.filter((arg) => arg.startsWith('$'));
}

function validateTemplateSchema(template: Template, issues: TemplateValidationIssue[]): void {
  const parsed = templateSchema.safeParse(template);

  if (!parsed.success) {
    addIssue(issues, {
      code: TEMPLATE_VALIDATION_ISSUE_CODES.INVALID_TEMPLATE_SCHEMA,
      templateId: template.id,
      path: 'template',
      message: `Template ${template.id} does not satisfy the shared template schema.`,
    });
  }
}

function validateTemplateKeywords(template: Template, issues: TemplateValidationIssue[]): void {
  const hasUsableKeyword = template.intentKeywords.some((keyword) => keyword.trim().length > 0);

  if (!hasUsableKeyword) {
    addIssue(issues, {
      code: TEMPLATE_VALIDATION_ISSUE_CODES.EMPTY_INTENT_KEYWORDS,
      templateId: template.id,
      path: 'intentKeywords',
      message: `Template ${template.id} must expose at least one non-empty intent keyword.`,
    });
  }
}

function validateTemplatePlaceholders(
  template: Template,
  metadata: SepoliaTemplateMetadata | undefined,
  issues: TemplateValidationIssue[],
): void {
  const parameterPlaceholders = new Set(
    template.parameters.map((parameter) => `$${parameter.name}`),
  );
  const runtimePlaceholders = new Set(metadata?.runtimePlaceholders ?? []);

  for (const action of template.actions) {
    for (const placeholder of collectActionPlaceholders(action.args)) {
      if (parameterPlaceholders.has(placeholder) || runtimePlaceholders.has(placeholder)) {
        continue;
      }

      addIssue(issues, {
        code: TEMPLATE_VALIDATION_ISSUE_CODES.UNDECLARED_PLACEHOLDER,
        templateId: template.id,
        path: `actions.${action.contract}.${action.method}`,
        message: `${template.id}.${action.method} uses undeclared placeholder ${placeholder}.`,
      });
    }
  }

  for (const runtimeValue of metadata?.runtimePlaceholderValues ?? []) {
    if (!runtimePlaceholders.has(runtimeValue.placeholder)) {
      addIssue(issues, {
        code: TEMPLATE_VALIDATION_ISSUE_CODES.UNDECLARED_PLACEHOLDER,
        templateId: template.id,
        path: 'runtimePlaceholderValues',
        message: `${template.id} resolves undeclared runtime placeholder ${runtimeValue.placeholder}.`,
      });
    }
  }
}

function validateMetadataSafety(
  metadata: SepoliaTemplateMetadata,
  issues: TemplateValidationIssue[],
): void {
  for (const unsafeOperation of unsafeOperations) {
    if (!metadata.unsupportedOperations.includes(unsafeOperation)) {
      addIssue(issues, {
        code: TEMPLATE_VALIDATION_ISSUE_CODES.UNSAFE_OPERATION_NOT_BLOCKED,
        templateId: metadata.templateId,
        path: 'unsupportedOperations',
        message: `${metadata.templateId} must explicitly block ${unsafeOperation}.`,
      });
    }
  }
}

function validateMetadataShape(
  metadata: SepoliaTemplateMetadata,
  issues: TemplateValidationIssue[],
): void {
  if (metadata.chainId !== SEPOLIA_CHAIN_ID) {
    addIssue(issues, {
      code: TEMPLATE_VALIDATION_ISSUE_CODES.INVALID_SEPOLIA_METADATA,
      templateId: metadata.templateId,
      path: 'chainId',
      message: `${metadata.templateId} must target Sepolia chain id ${SEPOLIA_CHAIN_ID}.`,
    });
  }

  if (metadata.network !== 'sepolia') {
    addIssue(issues, {
      code: TEMPLATE_VALIDATION_ISSUE_CODES.INVALID_SEPOLIA_METADATA,
      templateId: metadata.templateId,
      path: 'network',
      message: `${metadata.templateId} must use sepolia network metadata.`,
    });
  }

  if (metadata.executionMode !== DRY_RUN_ONLY) {
    addIssue(issues, {
      code: TEMPLATE_VALIDATION_ISSUE_CODES.INVALID_SEPOLIA_METADATA,
      templateId: metadata.templateId,
      path: 'executionMode',
      message: `${metadata.templateId} must remain dry-run only.`,
    });
  }

  if (!metadata.demoOnly) {
    addIssue(issues, {
      code: TEMPLATE_VALIDATION_ISSUE_CODES.INVALID_SEPOLIA_METADATA,
      templateId: metadata.templateId,
      path: 'demoOnly',
      message: `${metadata.templateId} must remain demo-only.`,
    });
  }
}

function validateHumanConfirmationState(
  metadata: SepoliaTemplateMetadata,
  issues: TemplateValidationIssue[],
): void {
  if (metadata.requiresHumanConfirmation && metadata.unresolvedHumanConfirmations.length === 0) {
    addIssue(issues, {
      code: TEMPLATE_VALIDATION_ISSUE_CODES.MISSING_HUMAN_CONFIRMATION,
      templateId: metadata.templateId,
      path: 'unresolvedHumanConfirmations',
      message: `${metadata.templateId} is human-gated but does not list unresolved confirmations.`,
    });
  }

  if (!metadata.requiresHumanConfirmation && metadata.unresolvedHumanConfirmations.length > 0) {
    addIssue(issues, {
      code: TEMPLATE_VALIDATION_ISSUE_CODES.STALE_HUMAN_CONFIRMATION,
      templateId: metadata.templateId,
      path: 'unresolvedHumanConfirmations',
      message: `${metadata.templateId} is marked resolved but still lists unresolved confirmations.`,
    });
  }

  for (const contract of metadata.contracts) {
    if (contract.abi.status === NEEDS_HUMAN_CONFIRMATION && contract.abi.fragments.length !== 0) {
      addIssue(issues, {
        code: TEMPLATE_VALIDATION_ISSUE_CODES.IMPLICIT_UNRESOLVED_VALUE,
        templateId: metadata.templateId,
        path: `contracts.${contract.contract}.abi`,
        message: `${metadata.templateId}.${contract.contract} ABI is unresolved but exposes fragments.`,
      });
    }

    if (contract.abi.status === HUMAN_CONFIRMED && contract.abi.fragments.length === 0) {
      addIssue(issues, {
        code: TEMPLATE_VALIDATION_ISSUE_CODES.INVALID_SEPOLIA_METADATA,
        templateId: metadata.templateId,
        path: `contracts.${contract.contract}.abi`,
        message: `${metadata.templateId}.${contract.contract} ABI is confirmed but has no fragments.`,
      });
    }

    if (contract.address.kind !== 'protocol-address' && contract.address.kind !== 'mock-address') {
      continue;
    }

    if (
      contract.address.confirmation === NEEDS_HUMAN_CONFIRMATION &&
      contract.address.value !== NEEDS_HUMAN_CONFIRMATION
    ) {
      addIssue(issues, {
        code: TEMPLATE_VALIDATION_ISSUE_CODES.IMPLICIT_UNRESOLVED_VALUE,
        templateId: metadata.templateId,
        path: `contracts.${contract.contract}.address`,
        message: `${metadata.templateId}.${contract.contract} address is unresolved but is not explicit.`,
      });
    }
  }
}

function sameItems(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length && actual.every((item, index) => item === expected[index])
  );
}

function addInvalidAbiIssue(
  issues: TemplateValidationIssue[],
  metadata: SepoliaTemplateMetadata,
  contract: SepoliaContractMetadata,
  method: string,
  message: string,
): void {
  addIssue(issues, {
    code: TEMPLATE_VALIDATION_ISSUE_CODES.INVALID_ABI_FRAGMENT,
    templateId: metadata.templateId,
    path: `contracts.${contract.contract}.abi.${method}`,
    message,
  });
}

function validateAbiFragmentShape(
  metadata: SepoliaTemplateMetadata,
  contract: SepoliaContractMetadata,
  fragment: SepoliaAbiFragment,
  requirement: AbiFragmentRequirement,
  issues: TemplateValidationIssue[],
): void {
  const inputNames = fragment.inputs.map((input) => input.name);
  const inputTypes = fragment.inputs.map((input) => input.type);
  const outputTypes = fragment.outputs.map((output) => output.type);

  if (fragment.type !== 'function') {
    addInvalidAbiIssue(
      issues,
      metadata,
      contract,
      fragment.name,
      `${metadata.templateId}.${contract.contract}.${fragment.name} must be a function fragment.`,
    );
  }

  if (fragment.stateMutability !== requirement.stateMutability) {
    addInvalidAbiIssue(
      issues,
      metadata,
      contract,
      fragment.name,
      `${metadata.templateId}.${contract.contract}.${fragment.name} must be ${requirement.stateMutability}.`,
    );
  }

  if (!sameItems(inputNames, requirement.inputNames)) {
    addInvalidAbiIssue(
      issues,
      metadata,
      contract,
      fragment.name,
      `${metadata.templateId}.${contract.contract}.${fragment.name} has unexpected input names.`,
    );
  }

  if (!sameItems(inputTypes, requirement.inputTypes)) {
    addInvalidAbiIssue(
      issues,
      metadata,
      contract,
      fragment.name,
      `${metadata.templateId}.${contract.contract}.${fragment.name} has unexpected input types.`,
    );
  }

  if (!sameItems(outputTypes, requirement.outputTypes)) {
    addInvalidAbiIssue(
      issues,
      metadata,
      contract,
      fragment.name,
      `${metadata.templateId}.${contract.contract}.${fragment.name} has unexpected output types.`,
    );
  }

  if (!requirement.tupleComponentNames || !requirement.tupleComponentTypes) {
    return;
  }

  const tupleInput = fragment.inputs[0];
  const tupleComponentNames = tupleInput?.components?.map((component) => component.name) ?? [];
  const tupleComponentTypes = tupleInput?.components?.map((component) => component.type) ?? [];

  if (!sameItems(tupleComponentNames, requirement.tupleComponentNames)) {
    addInvalidAbiIssue(
      issues,
      metadata,
      contract,
      fragment.name,
      `${metadata.templateId}.${contract.contract}.${fragment.name} has unexpected tuple component names.`,
    );
  }

  if (!sameItems(tupleComponentTypes, requirement.tupleComponentTypes)) {
    addInvalidAbiIssue(
      issues,
      metadata,
      contract,
      fragment.name,
      `${metadata.templateId}.${contract.contract}.${fragment.name} has unexpected tuple component types.`,
    );
  }
}

function validateAbiFragments(
  metadata: SepoliaTemplateMetadata,
  issues: TemplateValidationIssue[],
): void {
  for (const contract of metadata.contracts) {
    if (contract.abi.status !== HUMAN_CONFIRMED) {
      continue;
    }

    for (const requiredMethod of contract.requiredMethods) {
      const fragment = contract.abi.fragments.find(
        (candidate) => candidate.name === requiredMethod,
      );

      if (!fragment) {
        addIssue(issues, {
          code: TEMPLATE_VALIDATION_ISSUE_CODES.MISSING_REQUIRED_ABI_FRAGMENT,
          templateId: metadata.templateId,
          path: `contracts.${contract.contract}.abi.${requiredMethod}`,
          message: `${metadata.templateId}.${contract.contract} is missing required ABI method ${requiredMethod}.`,
        });
        continue;
      }

      const requirement = abiFragmentRequirements[requiredMethod];

      if (requirement) {
        validateAbiFragmentShape(metadata, contract, fragment, requirement, issues);
      }
    }
  }
}

function validateMetadata(
  metadata: SepoliaTemplateMetadata,
  issues: TemplateValidationIssue[],
): void {
  validateMetadataShape(metadata, issues);
  validateHumanConfirmationState(metadata, issues);
  validateAbiFragments(metadata, issues);
  validateMetadataSafety(metadata, issues);
}

export function validateTemplatesForSepolia(
  options: TemplateValidationOptions = {},
): TemplateValidationResult {
  const templates = options.templates ?? defaultTemplates;
  const metadata = (options.metadata ?? sepoliaTemplateMetadata) as SepoliaMetadataMap;
  const issues: TemplateValidationIssue[] = [];
  const seenTemplateIds = new Set<string>();

  for (const template of templates) {
    validateTemplateSchema(template, issues);
    validateTemplateKeywords(template, issues);

    if (seenTemplateIds.has(template.id)) {
      addIssue(issues, {
        code: TEMPLATE_VALIDATION_ISSUE_CODES.DUPLICATE_TEMPLATE_ID,
        templateId: template.id,
        path: 'id',
        message: `Duplicate template id ${template.id}.`,
      });
    }
    seenTemplateIds.add(template.id);

    const templateMetadata = metadata[template.id];

    if (!templateMetadata) {
      addIssue(issues, {
        code: TEMPLATE_VALIDATION_ISSUE_CODES.MISSING_SEPOLIA_METADATA,
        templateId: template.id,
        path: 'sepoliaTemplateMetadata',
        message: `Missing Sepolia metadata for ${template.id}.`,
      });
      continue;
    }

    if (templateMetadata.templateId !== template.id) {
      addIssue(issues, {
        code: TEMPLATE_VALIDATION_ISSUE_CODES.INVALID_SEPOLIA_METADATA,
        templateId: template.id,
        path: 'templateId',
        message: `Metadata key ${template.id} does not match metadata id ${templateMetadata.templateId}.`,
      });
    }

    validateTemplatePlaceholders(template, templateMetadata, issues);
    validateMetadata(templateMetadata, issues);
  }

  for (const metadataTemplateId of Object.keys(metadata)) {
    if (!seenTemplateIds.has(metadataTemplateId)) {
      addIssue(issues, {
        code: TEMPLATE_VALIDATION_ISSUE_CODES.ORPHAN_SEPOLIA_METADATA,
        templateId: metadataTemplateId,
        path: 'sepoliaTemplateMetadata',
        message: `Sepolia metadata exists for unknown template ${metadataTemplateId}.`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function assertTemplatesValidForSepolia(options: TemplateValidationOptions = {}): void {
  const result = validateTemplatesForSepolia(options);

  if (!result.ok) {
    throw new Error(result.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
  }
}
