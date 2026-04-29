import type { Template } from '@loomlabs/schema';

export const uniswapDcaTemplate: Template = {
  id: 'uniswap-dca',
  name: 'Uniswap DCA',
  protocol: 'uniswap',
  category: 'trade',
  description: 'Dollar-cost-average into a token on a schedule via Uniswap.',
  intentKeywords: ['uniswap', 'dca', 'dollar cost average', 'buy weekly', 'recurring swap'],
  parameters: [
    { name: 'tokenIn', type: 'address', required: true, description: 'Token to spend' },
    { name: 'tokenOut', type: 'address', required: true, description: 'Token to buy' },
    { name: 'amountIn', type: 'uint256', required: true, description: 'Amount per buy' },
    { name: 'interval', type: 'duration', required: true, description: 'Interval (e.g. 1w)' },
    {
      name: 'slippageBps',
      type: 'number',
      required: false,
      description: 'Slippage bps',
      default: 50,
    },
  ],
  trigger: { type: 'cron', expression: '@interval' },
  actions: [
    { contract: 'ERC20', method: 'approve', args: ['$UNISWAP_ROUTER', '$amountIn'] },
    {
      contract: 'UniswapRouter',
      method: 'exactInputSingle',
      args: ['$tokenIn', '$tokenOut', '500', '$user', '$amountIn', '0', '0'],
    },
  ],
};
