import { http } from 'wagmi';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Define Core Blockchain Testnet
const coreTestnet = {
  id: 1115,
  name: 'Core Blockchain Testnet',
  network: 'core-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'tCORE',
    symbol: 'tCORE',
  },
  rpcUrls: {
    default: { http: ['https://rpc.test.btcs.network'] },
    public: { http: ['https://rpc.test.btcs.network'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://scan.test.btcs.network' },
  },
  testnet: true,
} as const;

// Create wagmi config with RainbowKit
export const wagmiConfig = getDefaultConfig({
  appName: 'Web3 Scribble',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID!,
  chains: [coreTestnet],
  transports: {
    [coreTestnet.id]: http(),
  },
});

// Export chains if needed elsewhere in your app
export const chains = [coreTestnet];
