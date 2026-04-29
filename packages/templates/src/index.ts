import type { Template } from '@loomlabs/schema';

import { aaveRecurringDepositTemplate } from './aave-recurring-deposit';
import { lidoStakeTemplate } from './lido-stake';
import { uniswapDcaTemplate } from './uniswap-dca';

export { aaveRecurringDepositTemplate, lidoStakeTemplate, uniswapDcaTemplate };
export {
  DRY_RUN_ONLY,
  HUMAN_CONFIRMED,
  NEEDS_HUMAN_CONFIRMATION,
  SEPOLIA_CHAIN_ID,
  getSepoliaTemplateMetadata,
  sepoliaTemplateMetadata,
} from './sepolia-metadata';
export {
  TEMPLATE_VALIDATION_ISSUE_CODES,
  assertTemplatesValidForSepolia,
  validateTemplatesForSepolia,
} from './validation';
export type {
  SepoliaMetadataMap,
  TemplateValidationIssue,
  TemplateValidationIssueCode,
  TemplateValidationOptions,
  TemplateValidationResult,
} from './validation';
export type {
  HumanConfirmationStatus,
  HumanConfirmedStatus,
  SepoliaAbiMetadata,
  SepoliaAbiFragment,
  SepoliaAbiParameter,
  SepoliaAddressSource,
  SepoliaContractMetadata,
  SepoliaDemoParameter,
  SepoliaLiquidityMetadata,
  SepoliaRuntimePlaceholderValue,
  SepoliaTemplateId,
  SepoliaTemplateMetadata,
  SepoliaVerificationTarget,
} from './sepolia-metadata';

/**
 * Central registry of all DeFi automation templates.
 * Roleset-3 members add new templates here.
 *
 * Plan:
 * - aave-recurring-deposit (done)
 * - uniswap-dca (done)
 * - lido-stake (done)
 * - aave-auto-deleverage (TODO - onchain trigger)
 * - uniswap-limit-order (TODO - price trigger)
 */
export const templates: Template[] = [
  aaveRecurringDepositTemplate,
  uniswapDcaTemplate,
  lidoStakeTemplate,
];

export function getTemplateById(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

export function findTemplatesByKeyword(keyword: string): Template[] {
  const k = keyword.toLowerCase();
  return templates.filter((t) => t.intentKeywords.some((kw) => kw.toLowerCase().includes(k)));
}
