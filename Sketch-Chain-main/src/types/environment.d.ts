declare namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_WALLET_CONNECT_ID: string;
      NEXT_PUBLIC_SOCKET_URL: string;
      NEXT_PUBLIC_CONTRACT_ADDRESS: string;
      NEXT_PUBLIC_MANTLE_SEPOLIA_RPC: string;
      NEXT_PUBLIC_ENVIRONMENT: 'development' | 'production';
    }
  }