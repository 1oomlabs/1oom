import { http, type Config, createConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

const connectors = [
  injected({ shimDisconnect: true }),
  coinbaseWallet({ appName: 'loomlabs' }),
  // WalletConnect requires a project id - skip the connector entirely if not provided
  // so we don't ship a broken option to users.
  ...(wcProjectId
    ? [
        walletConnect({
          projectId: wcProjectId,
          metadata: {
            name: 'loomlabs',
            description: 'Natural-language DeFi workflow automation',
            url: 'https://loomlabs.example',
            icons: [],
          },
          showQrModal: true,
        }),
      ]
    : []),
];

export const wagmiConfig: Config = createConfig({
  chains: [mainnet, sepolia],
  connectors,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: false,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}

/** Default chain users land on. Sepolia for hackathon demos. */
export const DEFAULT_CHAIN_ID = sepolia.id;
