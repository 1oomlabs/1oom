import { mainnet, sepolia } from 'wagmi/chains';

export const SUPPORTED_CHAINS = [
  { id: sepolia.id, label: 'Sepolia', explorer: 'https://sepolia.etherscan.io' },
  { id: mainnet.id, label: 'Ethereum', explorer: 'https://etherscan.io' },
] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]['id'];

export function chainLabel(id?: number): string {
  return SUPPORTED_CHAINS.find((c) => c.id === id)?.label ?? `Chain ${id ?? '?'}`;
}

const DEFAULT_EXPLORER_BASE = SUPPORTED_CHAINS[0].explorer;

export function explorerTxUrl(txHash: string, chainId?: number): string {
  const base = SUPPORTED_CHAINS.find((c) => c.id === chainId)?.explorer ?? DEFAULT_EXPLORER_BASE;
  return `${base}/tx/${txHash}`;
}

export function explorerAddressUrl(address: string, chainId?: number): string {
  const base = SUPPORTED_CHAINS.find((c) => c.id === chainId)?.explorer ?? DEFAULT_EXPLORER_BASE;
  return `${base}/address/${address}`;
}

export const DEFAULT_PUBLISH_PRICING = { type: 'free' } as const;

export const ADDRESS_PREFIX_LEN = 6;
export const ADDRESS_SUFFIX_LEN = 4;

export function shortenAddress(addr: string): string {
  if (addr.length <= ADDRESS_PREFIX_LEN + ADDRESS_SUFFIX_LEN + 2) return addr;
  return `${addr.slice(0, ADDRESS_PREFIX_LEN)}…${addr.slice(-ADDRESS_SUFFIX_LEN)}`;
}

export const COPIED_RESET_MS = 1200;
export const TOAST_DEFAULT_DURATION_MS = 4000;

export const CURRENT_AGENT_ID = 'loomlabs';
