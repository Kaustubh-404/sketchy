import { JWKInterface } from 'arweave/node/lib/wallet';
import arweave, { getWalletAddress } from '../services/arweaveService';

/**
 * Formats an Arweave transaction ID for display
 * @param txId - The transaction ID to format
 * @param length - Number of characters to show at start and end
 */
export const formatTxId = (txId: string, length: number = 6): string => {
  if (!txId || txId.length <= length * 2) return txId;
  return `${txId.substring(0, length)}...${txId.substring(txId.length - length)}`;
};

/**
 * Formats an Arweave address for display
 * @param address - The address to format
 * @param length - Number of characters to show at start and end
 */
export const formatAddress = (address: string, length: number = 6): string => {
  if (!address || address.length <= length * 2) return address;
  return `${address.substring(0, length)}...${address.substring(address.length - length)}`;
};

/**
 * Gets an Arweave transaction view URL
 * @param txId - The transaction ID
 * @returns URL to view the transaction on an Arweave explorer
 */
export const getExplorerUrl = (txId: string): string => {
  return `https://viewblock.io/arweave/tx/${txId}`;
};

/**
 * Validates an Arweave wallet JWK
 * @param wallet - The wallet JWK to validate
 * @returns True if wallet is valid
 */
export const validateWallet = async (wallet: any): Promise<boolean> => {
  try {
    if (!wallet || typeof wallet !== 'object') return false;
    
    // Check for required JWK properties
    const requiredProps = ['kty', 'n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi'];
    for (const prop of requiredProps) {
      if (!wallet[prop]) return false;
    }
    
    // Try to derive address from wallet
    await getWalletAddress(wallet);
    return true;
  } catch (error) {
    console.error('Error validating wallet:', error);
    return false;
  }
};

/**
 * Calculates the approximate AR cost for storing data
 * @param dataSize - Size of the data in bytes
 * @returns Approximate cost in AR
 */
export const calculateStorageCost = (dataSize: number): number => {
  // Very simplified cost estimation
  // Actual cost depends on network conditions and data size
  const bytesPerAR = 1024 * 1024 * 2; // Approx 2MB per AR
  return dataSize / bytesPerAR;
};

/**
 * Checks if there's enough balance to store data
 * @param wallet - The wallet JWK
 * @param dataSize - Size of the data in bytes
 * @returns True if the wallet has enough balance
 */
export const hasEnoughBalance = async (wallet: JWKInterface, dataSize: number): Promise<boolean> => {
  try {
    const address = await getWalletAddress(wallet);
    const balanceWinston = await arweave.wallets.getBalance(address);
    const balanceAR = arweave.ar.winstonToAr(balanceWinston);
    
    const estimatedCost = calculateStorageCost(dataSize);
    return parseFloat(balanceAR) >= estimatedCost;
  } catch (error) {
    console.error('Error checking balance:', error);
    return false;
  }
};

/**
 * Creates a data bundle for more efficient storage of multiple items
 * @param items - Array of objects to store
 * @param tags - Common tags to apply to all items
 * @param wallet - The wallet JWK
 * @returns Transaction ID of the bundle
 */
export const createDataBundle = async (
  items: any[],
  tags: { name: string; value: string }[],
  wallet: JWKInterface
): Promise<string> => {
  try {
    // Convert items to buffer
    const itemsData = JSON.stringify(items);
    const itemsBuffer = Buffer.from(itemsData);
    
    // Create transaction
    const transaction = await arweave.createTransaction({
      data: itemsBuffer
    }, wallet);
    
    // Add tags
    tags.forEach(tag => {
      transaction.addTag(tag.name, tag.value);
    });
    
    // Add bundle-specific tags
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('Bundle-Format', 'json');
    transaction.addTag('Bundle-Version', '1.0.0');
    transaction.addTag('Bundle-Items', items.length.toString());
    
    // Sign and post transaction
    await arweave.transactions.sign(transaction, wallet);
    const response = await arweave.transactions.post(transaction);
    
    if (response.status === 200 || response.status === 202) {
      return transaction.id;
    } else {
      throw new Error(`Failed to post transaction: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error creating data bundle:', error);
    throw error;
  }
};

/**
 * Generates a permalink to access content on the permaweb
 * @param txId - The transaction ID
 * @returns Permaweb URL
 */
export const getPermawebUrl = (txId: string): string => {
  return `https://arweave.net/${txId}`;
};