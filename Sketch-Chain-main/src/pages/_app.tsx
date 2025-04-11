
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { WagmiProvider } from 'wagmi';
import '@rainbow-me/rainbowkit/styles.css';
// import { ConnectButton } from '@rainbow-me/rainbowkit'; 
import { RainbowKitProvider} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { wagmiConfig } from '@/config/web3';
// import { Layout } from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ConnectionGuard } from '@/components/ConnectionGaurd';
import { ClientOnly } from '@/components/ClientOnly'

// Create a client for react-query
const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>

        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <ClientOnly>
            <ConnectionGuard>

                <Component {...pageProps} />
                <div className="z-[9999]">
                  <Toaster position="top-right" />
                </div>

            </ConnectionGuard>
            </ClientOnly>
          </RainbowKitProvider>
        </QueryClientProvider>

    </ErrorBoundary>
  );
}