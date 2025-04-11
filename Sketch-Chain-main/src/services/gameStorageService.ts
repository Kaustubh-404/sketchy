import { storeData, getData, queryTransactions } from './arweaveService';
import { JWKInterface } from 'arweave/node/lib/wallet';

// App Name used for all Sketchy-related transactions
const APP_NAME = 'Sketchy';

// Game data types
export enum GameDataType {
  DRAWING = 'drawing',
  GAME_STATE = 'game-state',
  CHAT_HISTORY = 'chat-history',
  USER_PROFILE = 'user-profile',
  GAME_RESULT = 'game-result',
}

// Store a drawing to Arweave
export const storeDrawing = async (
  gameId: string,
  drawingData: any,
  wallet: JWKInterface,
  roundNumber: number,
  playerAddress: string
): Promise<string> => {
  const tags = [
    { name: 'App-Name', value: APP_NAME },
    { name: 'Game-ID', value: gameId },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Data-Type', value: GameDataType.DRAWING },
    { name: 'Round-Number', value: roundNumber.toString() },
    { name: 'Player-Address', value: playerAddress },
    { name: 'Timestamp', value: Date.now().toString() },
  ];

  return storeData(drawingData, wallet, 'application/json', tags);
};

// Store game state to Arweave
export const storeGameState = async (
  gameId: string,
  gameState: any,
  wallet: JWKInterface
): Promise<string> => {
  const tags = [
    { name: 'App-Name', value: APP_NAME },
    { name: 'Game-ID', value: gameId },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Data-Type', value: GameDataType.GAME_STATE },
    { name: 'Timestamp', value: Date.now().toString() },
  ];

  return storeData(gameState, wallet, 'application/json', tags);
};

// Store game results
export const storeGameResult = async (
  gameId: string,
  resultData: any,
  wallet: JWKInterface
): Promise<string> => {
  const tags = [
    { name: 'App-Name', value: APP_NAME },
    { name: 'Game-ID', value: gameId },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Data-Type', value: GameDataType.GAME_RESULT },
    { name: 'Timestamp', value: Date.now().toString() },
  ];

  return storeData(resultData, wallet, 'application/json', tags);
};

// Store chat history
export const storeChatHistory = async (
  gameId: string,
  chatData: any,
  wallet: JWKInterface
): Promise<string> => {
  const tags = [
    { name: 'App-Name', value: APP_NAME },
    { name: 'Game-ID', value: gameId },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Data-Type', value: GameDataType.CHAT_HISTORY },
    { name: 'Timestamp', value: Date.now().toString() },
  ];

  return storeData(chatData, wallet, 'application/json', tags);
};

// Save user profile
export const saveUserProfile = async (
  userAddress: string,
  profileData: any,
  wallet: JWKInterface
): Promise<string> => {
  const tags = [
    { name: 'App-Name', value: APP_NAME },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Data-Type', value: GameDataType.USER_PROFILE },
    { name: 'User-Address', value: userAddress },
    { name: 'Timestamp', value: Date.now().toString() },
  ];

  return storeData(profileData, wallet, 'application/json', tags);
};

// Get game data by game ID
export const getGameDrawings = async (gameId: string): Promise<any[]> => {
  try {
    const query = {
      op: 'and',
      expr1: {
        op: 'equals',
        expr1: 'App-Name',
        expr2: APP_NAME
      },
      expr2: {
        op: 'and',
        expr1: {
          op: 'equals',
          expr1: 'Game-ID',
          expr2: gameId
        },
        expr2: {
          op: 'equals',
          expr1: 'Data-Type',
          expr2: GameDataType.DRAWING
        }
      }
    };

    const txIds = await queryTransactions([
      { name: 'App-Name', values: [APP_NAME] },
      { name: 'Game-ID', values: [gameId] },
      { name: 'Data-Type', values: [GameDataType.DRAWING] }
    ]);

    const results = await Promise.all(
      txIds.map(async (txId) => {
        const data = await getData(txId);
        return { txId, data };
      })
    );

    return results;
  } catch (error) {
    console.error('Error fetching game drawings:', error);
    throw error;
  }
};

// Get user game history
export const getUserGameHistory = async (userAddress: string): Promise<any[]> => {
  try {
    const txIds = await queryTransactions([
      { name: 'App-Name', values: [APP_NAME] },
      { name: 'Data-Type', values: [GameDataType.GAME_RESULT] },
      { name: 'Player-Address', values: [userAddress] }
    ]);

    const results = await Promise.all(
      txIds.map(async (txId) => {
        const data = await getData(txId);
        return { txId, data };
      })
    );

    return results;
  } catch (error) {
    console.error('Error fetching user game history:', error);
    throw error;
  }
};

// Get user profile data
export const getUserProfile = async (userAddress: string): Promise<any | null> => {
  try {
    const txIds = await queryTransactions([
      { name: 'App-Name', values: [APP_NAME] },
      { name: 'Data-Type', values: [GameDataType.USER_PROFILE] },
      { name: 'User-Address', values: [userAddress] }
    ]);
    
    if (txIds.length === 0) {
      return null;
    }
    
    // Sort by timestamp (newest first)
    const sortedTxIds = await sortTransactionsByTimestamp(txIds);
    
    // Get the latest profile data
    const data = await getData(sortedTxIds[0]);
    return data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

// Helper function to sort transactions by timestamp
const sortTransactionsByTimestamp = async (txIds: string[]): Promise<string[]> => {
  // This is a simplified version - in a real implementation, you would 
  // fetch transaction data and sort by timestamp
  return txIds;
};

// Get recent game results
export const getRecentGames = async (limit = 10): Promise<any[]> => {
  try {
    const txIds = await queryTransactions([
      { name: 'App-Name', values: [APP_NAME] },
      { name: 'Data-Type', values: [GameDataType.GAME_RESULT] }
    ]);
    
    // Sort by timestamp (newest first)
    const sortedTxIds = await sortTransactionsByTimestamp(txIds);
    
    // Get the latest games up to the limit
    const limitedTxIds = sortedTxIds.slice(0, limit);
    
    const results = await Promise.all(
      limitedTxIds.map(async (txId) => {
        const data = await getData(txId);
        return { txId, data };
      })
    );
    
    return results;
  } catch (error) {
    console.error('Error fetching recent games:', error);
    throw error;
  }
};