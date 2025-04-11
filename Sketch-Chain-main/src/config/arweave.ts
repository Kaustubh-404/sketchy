// Arweave network configuration
export const ARWEAVE_CONFIG = {
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
    timeout: 20000,
    logging: false,
  };
  
  // SmartWeave configuration
  export const SMARTWEAVE_CONFIG = {
    evaluationOptions: {
      useKVStorage: true,
      internalWrites: true,
      allowBigInt: true,
      gasLimit: 10000000,
    },
  };
  
  // Minimum AR balance required to play
  export const MIN_AR_BALANCE = 0.01;
  
  // Arweave tags used for data organization
  export const ARWEAVE_TAGS = {
    APP_NAME: 'Sketchy',
    APP_VERSION: '1.0.0',
    CONTENT_TYPE: 'application/json',
    // Data types
    DATA_TYPES: {
      DRAWING: 'drawing',
      GAME_STATE: 'game-state',
      CHAT_HISTORY: 'chat-history',
      USER_PROFILE: 'user-profile',
      GAME_RESULT: 'game-result',
    },
    // Contract related tags
    CONTRACT: {
      APP_NAME: 'SmartWeaveContract',
      APP_VERSION: '0.3.0',
      CONTRACT_TYPE: 'js-v2',
    },
  };
  
  // Default gas settings for SmartWeave interactions
  export const DEFAULT_GAS_SETTINGS = {
    gasLimit: 5000000,
  };
  
  // Arweave explorer URLs
  export const ARWEAVE_EXPLORERS = {
    VIEWBLOCK: 'https://viewblock.io/arweave/tx/',
    ARWEAVE_NET: 'https://arweave.net/',
  };
  
  // Arweave faucet URL
  export const ARWEAVE_FAUCET_URL = 'https://faucet.arweave.net/';