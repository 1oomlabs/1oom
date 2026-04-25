import type { Template } from '@loomlabs/schema';

import { aaveRecurringDepositTemplate } from './aave-recurring-deposit';
import { lidoStakeTemplate } from './lido-stake';
import { uniswapDcaTemplate } from './uniswap-dca';

export { aaveRecurringDepositTemplate, lidoStakeTemplate, uniswapDcaTemplate };

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
