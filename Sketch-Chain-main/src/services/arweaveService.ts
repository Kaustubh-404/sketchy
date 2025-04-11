import Arweave from 'arweave';
import { ArweaveSigner, createData } from 'arbundles';
import { JWKInterface } from 'arweave/node/lib/wallet';

// Initialize Arweave instance
let arweave: Arweave;

// Initialize for browser environment
if (typeof window !== 'undefined') {
  arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
  });
} else {
  // Server-side initialization
  arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
  });
}

// Wallet handling
export const generateWallet = async (): Promise<JWKInterface> => {
  const key = await arweave.wallets.generate();
  return key;
};

export const getWalletAddress = async (key: JWKInterface): Promise<string> => {
  return await arweave.wallets.jwkToAddress(key);
};

export const getWalletBalance = async (address: string): Promise<string> => {
  const winston = await arweave.wallets.getBalance(address);
  return arweave.ar.winstonToAr(winston);
};

// Data transaction helpers
export const storeData = async (
  data: any,
  wallet: JWKInterface,
  contentType: string = 'application/json',
  tags: { name: string; value: string }[] = []
): Promise<string> => {
  try {
    // Create transaction with the provided data
    const transaction = await arweave.createTransaction({
      data: JSON.stringify(data),
    }, wallet);

    // Set content type
    transaction.addTag('Content-Type', contentType);

    // Add custom tags
    tags.forEach(tag => {
      transaction.addTag(tag.name, tag.value);
    });

    // Sign the transaction with the wallet
    await arweave.transactions.sign(transaction, wallet);

    // Submit the transaction to the network
    const response = await arweave.transactions.post(transaction);

    if (response.status === 200 || response.status === 202) {
      return transaction.id;
    } else {
      throw new Error(`Failed to submit transaction: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error storing data on Arweave:', error);
    throw error;
  }
};

// Store drawing data with proper tags for retrieval
export const storeDrawingData = async (
  gameId: string, 
  drawingData: any, 
  wallet: JWKInterface
): Promise<string> => {
  const tags = [
    { name: 'App-Name', value: 'Sketchy' },
    { name: 'Game-ID', value: gameId },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Type', value: 'drawing-data' },
    { name: 'Timestamp', value: Date.now().toString() }
  ];

  return storeData(drawingData, wallet, 'application/json', tags);
};

// Store game state data for permanent record
export const storeGameState = async (
  gameId: string, 
  gameState: any, 
  wallet: JWKInterface
): Promise<string> => {
  const tags = [
    { name: 'App-Name', value: 'Sketchy' },
    { name: 'Game-ID', value: gameId },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Type', value: 'game-state' },
    { name: 'Timestamp', value: Date.now().toString() }
  ];

  return storeData(gameState, wallet, 'application/json', tags);
};

// Get data from a transaction
export const getData = async (transactionId: string): Promise<any> => {
  try {
    const data = await arweave.transactions.getData(transactionId, {
      decode: true,
      string: true
    });
    return JSON.parse(data as string);
  } catch (error) {
    console.error('Error getting data from Arweave:', error);
    throw error;
  }
};

// Query transactions by tags
export const queryTransactions = async (tags: { name: string; values: string[] }[]): Promise<string[]> => {
  try {
    let query = '';
    
    tags.forEach((tag, index) => {
      tag.values.forEach((value, valueIndex) => {
        query += `tags.${tag.name} == "${value}"`;
        if (valueIndex < tag.values.length - 1) {
          query += ' OR ';
        }
      });
      if (index < tags.length - 1) {
        query += ' AND ';
      }
    });

    const results = await arweave.arql({
      op: 'and',
      expr1: {
        op: 'equals',
        expr1: 'App-Name',
        expr2: 'Sketchy'
      },
      expr2: {
        op: 'equals',
        expr1: 'Game-ID',
        expr2: 'YOUR_GAME_ID'
      }
    });

    return results;
  } catch (error) {
    console.error('Error querying Arweave transactions:', error);
    throw error;
  }
};

// Chunked uploading for larger data files (like drawings)
export const uploadLargeData = async (
  data: any,
  wallet: JWKInterface,
  tags: { name: string; value: string }[] = []
): Promise<string> => {
  try {
    // Create a new transaction
    const transaction = await arweave.createTransaction({
      data: JSON.stringify(data),
    }, wallet);

    // Add tags
    tags.forEach(tag => {
      transaction.addTag(tag.name, tag.value);
    });

    // Sign the transaction
    await arweave.transactions.sign(transaction, wallet);

    // Get uploader
    const uploader = await arweave.transactions.getUploader(transaction);

    // Upload chunks
    while (!uploader.isComplete) {
      await uploader.uploadChunk();
      console.log(`Uploaded ${uploader.pctComplete}% complete`);
    }

    return transaction.id;
  } catch (error) {
    console.error('Error uploading large data to Arweave:', error);
    throw error;
  }
};

export default arweave;