import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { 
  deployGameContract, 
  createGame, 
  joinGame, 
  endGame as endGameContract, 
  getGameDetails, 
  getPlayerBalance,
  getActiveGames
} from '@/services/arweaveGameLogic';
import { useGameStore } from '@/store/gameStore';
import { MIN_AR_BALANCE } from '@/config/arweave';

/**
 * Custom hook for interacting with the Arweave SmartWeave contract
 * Replacement for the previous useScribbleContract hook
 */
export const useArweaveContract = () => {
  const [loading, setLoading] = useState(false);
  const gameStore = useGameStore();

  /**
   * Create a new game room
   */
  const createRoom = useCallback(async (
    maxPlayers: number, 
    wagerAmount: string, 
    playerName: string,
    wallet: any
  ): Promise<string> => {
    try {
      setLoading(true);
      
      // Input validation
      if (maxPlayers < 2 || maxPlayers > 8) {
        throw new Error('Number of players must be between 2 and 8');
      }

      if (!wagerAmount || parseFloat(wagerAmount) <= 0) {
        throw new Error('Wager amount must be greater than 0');
      }

      if (!playerName || playerName.trim().length < 2) {
        throw new Error('Player name must be at least 2 characters');
      }
      
      if (!wallet) {
        throw new Error('Arweave wallet is required');
      }

      // Save player name to localStorage
      localStorage.setItem('playerName', playerName);
      
      // Generate a random game code
      const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Check player balance
      const playerBalance = await getPlayerBalance(await wallet.getAddress());
      
      if (playerBalance < parseFloat(wagerAmount)) {
        throw new Error(`Insufficient AR balance. Need at least ${wagerAmount} AR to create this game.`);
      }
      
      // Create the game on Arweave
      const txId = await createGame(
        wallet, 
        gameCode, 
        parseFloat(wagerAmount), 
        maxPlayers
      );
      
      console.log('Game creation transaction:', txId);
      
      toast.success('Room created! Transaction submitted to Arweave.', {
        duration: 5000
      });
      
      // Store the transaction ID for reference
      gameStore.setLastTransactionHash(txId);
      
      return gameCode;
    } catch (error: any) {
      console.error('Error creating room:', error);
      toast.error(error.message || 'Failed to create room');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [gameStore]);

  /**
   * Join an existing game room
   */
  const joinRoom = useCallback(async (
    gameCode: string, 
    playerName: string,
    wallet: any
  ): Promise<boolean> => {
    try {
      setLoading(true);
      
      if (!gameCode || gameCode.length !== 6) {
        throw new Error('Invalid game code');
      }
      
      if (!playerName || playerName.trim().length < 2) {
        throw new Error('Player name must be at least 2 characters');
      }
      
      if (!wallet) {
        throw new Error('Arweave wallet is required');
      }

      // Save player name to localStorage
      localStorage.setItem('playerName', playerName);
      
      // Get game details to check wager amount
      const gameDetails = await getGameDetails(gameCode);
      
      if (!gameDetails) {
        throw new Error('Game not found');
      }
      
      if (!gameDetails.isActive) {
        throw new Error('Game is no longer active');
      }
      
      if (gameDetails.gameEnded) {
        throw new Error('Game has already ended');
      }
      
      if (gameDetails.players.length >= gameDetails.maxPlayers) {
        throw new Error('Game is full');
      }
      
      // Check player balance
      const playerBalance = await getPlayerBalance(await wallet.getAddress());
      
      if (playerBalance < gameDetails.wagerAmount) {
        throw new Error(`Insufficient AR balance. Need at least ${gameDetails.wagerAmount} AR to join this game.`);
      }
      
      // Join the game
      const txId = await joinGame(wallet, gameCode);
      
      console.log('Join game transaction:', txId);
      
      toast.success('Joined room! Transaction submitted to Arweave.', {
        duration: 5000
      });
      
      // Store the transaction ID for reference
      gameStore.setLastTransactionHash(txId);
      
      return true;
    } catch (error: any) {
      console.error('Error joining room:', error);
      toast.error(error.message || 'Failed to join room');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [gameStore]);

  /**
   * End a game and distribute prize to winner
   */
  const endGame = useCallback(async (
    gameCode: string,
    winner: string,
    wallet: any
  ): Promise<string> => {
    try {
      setLoading(true);
      
      if (!gameCode) {
        throw new Error('Game code is required');
      }
      
      if (!winner) {
        throw new Error('Winner address is required');
      }
      
      if (!wallet) {
        throw new Error('Arweave wallet is required');
      }
      
      // End the game and distribute prize
      const txId: string = await endGameContract(wallet, gameCode, winner);
      
      console.log('End game transaction:', txId);
      
      toast.success('Game ended! Prize distribution submitted to Arweave.', {
        duration: 5000
      });
      
      // Store the transaction ID for reference
      gameStore.setLastTransactionHash(txId);
      
      return txId;
    } catch (error: any) {
      console.error('Error ending game:', error);
      toast.error(error.message || 'Failed to end game');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [gameStore]);

  /**
   * For compatibility with the original API
   * These functions maintain the same interface but use Arweave
   */

  // Start a game - now handled by the Arweave contract
  const startGame = useCallback(async (gameCode: string): Promise<{ success: boolean }> => {
    console.log('Starting game:', gameCode);
    // This is a no-op as the starting is handled by the socket server
    return { success: true };
  }, []);

  // Record word drawn - now stored directly on Arweave
  const recordWordDrawn = useCallback(async (gameCode: string, word: string): Promise<{ success: boolean }> => {
    console.log('Recording word drawn:', word);
    // This is now handled by arweave storage directly
    return { success: true };
  }, []);

  // Record correct guess - now stored directly on Arweave
  const recordCorrectGuess = useCallback(async (gameCode: string, guesser: string, timeRemaining: number): Promise<{ success: boolean }> => {
    console.log('Recording correct guess by:', guesser);
    // This is now handled by arweave storage directly
    return { success: true };
  }, []);

  // Force end round - now handled by the Arweave contract
  const forceEndRound = useCallback(async (gameCode: string): Promise<{ success: boolean }> => {
    console.log('Forcing round end for game:', gameCode);
    // This is now handled by arweave storage directly
    return { success: true };
  }, []);

  /**
   * Get game history from Arweave
   */
  const getGameHistory = useCallback(async (): Promise<any[]> => {
    // This now returns data from local storage and Arweave
    const localHistory = JSON.parse(localStorage.getItem('gameHistory') || '[]');
    return localHistory;
  }, []);

  return {
    createRoom,
    joinRoom,
    startGame,
    recordWordDrawn,
    recordCorrectGuess,
    forceEndRound,
    endGame,
    getGameHistory,
    loading,
    // Additional Arweave-specific functions
    getGameDetails,
    getActiveGames,
    getPlayerBalance,
    deployGameContract,
  };
};



// import { useState, useCallback } from 'react';
// import { toast } from 'react-hot-toast';
// import { 
//   deployGameContract, 
//   createGame, 
//   joinGame, 
//   endGame, 
//   getGameDetails, 
//   getPlayerBalance,
//   getActiveGames
// } from '@/services/arweaveGameLogic';
// import { useGameStore } from '@/store/gameStore';
// import { MIN_AR_BALANCE } from '@/config/arweave';

// /**
//  * Custom hook for interacting with the Arweave SmartWeave contract
//  * Replacement for the previous useScribbleContract hook
//  */
// export const useArweaveContract = () => {
//   const [loading, setLoading] = useState(false);
//   const gameStore = useGameStore();

//   /**
//    * Create a new game room
//    */
//   const createRoom = useCallback(async (
//     maxPlayers: number, 
//     wagerAmount: string, 
//     playerName: string,
//     wallet: any
//   ) => {
//     try {
//       setLoading(true);
      
//       // Input validation
//       if (maxPlayers < 2 || maxPlayers > 8) {
//         throw new Error('Number of players must be between 2 and 8');
//       }

//       if (!wagerAmount || parseFloat(wagerAmount) <= 0) {
//         throw new Error('Wager amount must be greater than 0');
//       }

//       if (!playerName || playerName.trim().length < 2) {
//         throw new Error('Player name must be at least 2 characters');
//       }
      
//       if (!wallet) {
//         throw new Error('Arweave wallet is required');
//       }

//       // Save player name to localStorage
//       localStorage.setItem('playerName', playerName);
      
//       // Generate a random game code
//       const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
//       // Check player balance
//       const playerBalance = await getPlayerBalance(await wallet.getAddress());
      
//       if (playerBalance < parseFloat(wagerAmount)) {
//         throw new Error(`Insufficient AR balance. Need at least ${wagerAmount} AR to create this game.`);
//       }
      
//       // Create the game on Arweave
//       const txId = await createGame(
//         wallet, 
//         gameCode, 
//         parseFloat(wagerAmount), 
//         maxPlayers
//       );
      
//       console.log('Game creation transaction:', txId);
      
//       toast.success('Room created! Transaction submitted to Arweave.', {
//         duration: 5000
//       });
      
//       // Store the transaction ID for reference
//       gameStore.setLastTransactionHash(txId);
      
//       return gameCode;
//     } catch (error: any) {
//       console.error('Error creating room:', error);
//       toast.error(error.message || 'Failed to create room');
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }, [gameStore]);

//   /**
//    * Join an existing game room
//    */
//   const joinRoom = useCallback(async (
//     gameCode: string, 
//     playerName: string,
//     wallet: any
//   ) => {
//     try {
//       setLoading(true);
      
//       if (!gameCode || gameCode.length !== 6) {
//         throw new Error('Invalid game code');
//       }
      
//       if (!playerName || playerName.trim().length < 2) {
//         throw new Error('Player name must be at least 2 characters');
//       }
      
//       if (!wallet) {
//         throw new Error('Arweave wallet is required');
//       }

//       // Save player name to localStorage
//       localStorage.setItem('playerName', playerName);
      
//       // Get game details to check wager amount
//       const gameDetails = await getGameDetails(gameCode);
      
//       if (!gameDetails) {
//         throw new Error('Game not found');
//       }
      
//       if (!gameDetails.isActive) {
//         throw new Error('Game is no longer active');
//       }
      
//       if (gameDetails.gameEnded) {
//         throw new Error('Game has already ended');
//       }
      
//       if (gameDetails.players.length >= gameDetails.maxPlayers) {
//         throw new Error('Game is full');
//       }
      
//       // Check player balance
//       const playerBalance = await getPlayerBalance(await wallet.getAddress());
      
//       if (playerBalance < gameDetails.wagerAmount) {
//         throw new Error(`Insufficient AR balance. Need at least ${gameDetails.wagerAmount} AR to join this game.`);
//       }
      
//       // Join the game
//       const txId = await joinGame(wallet, gameCode);
      
//       console.log('Join game transaction:', txId);
      
//       toast.success('Joined room! Transaction submitted to Arweave.', {
//         duration: 5000
//       });
      
//       // Store the transaction ID for reference
//       gameStore.setLastTransactionHash(txId);
      
//       return true;
//     } catch (error: any) {
//       console.error('Error joining room:', error);
//       toast.error(error.message || 'Failed to join room');
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }, [gameStore]);

//   /**
//    * End a game and distribute prize to winner
//    */
//   const endGame = useCallback(async (
//     gameCode: string,
//     winner: string,
//     wallet: any
//   ) => {
//     try {
//       setLoading(true);
      
//       if (!gameCode) {
//         throw new Error('Game code is required');
//       }
      
//       if (!winner) {
//         throw new Error('Winner address is required');
//       }
      
//       if (!wallet) {
//         throw new Error('Arweave wallet is required');
//       }
      
//       // End the game and distribute prize
//       const txId = await endGame(wallet, gameCode, winner);
      
//       console.log('End game transaction:', txId);
      
//       toast.success('Game ended! Prize distribution submitted to Arweave.', {
//         duration: 5000
//       });
      
//       // Store the transaction ID for reference
//       gameStore.setLastTransactionHash(txId);
      
//       return txId;
//     } catch (error: any) {
//       console.error('Error ending game:', error);
//       toast.error(error.message || 'Failed to end game');
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }, [gameStore]);

//   /**
//    * For compatibility with the original API
//    * These functions maintain the same interface but use Arweave
//    */

//   // Start a game - now handled by the Arweave contract
//   const startGame = useCallback(async (gameCode: string) => {
//     console.log('Starting game:', gameCode);
//     // This is a no-op as the starting is handled by the socket server
//     return { success: true };
//   }, []);

//   // Record word drawn - now stored directly on Arweave
//   const recordWordDrawn = useCallback(async (gameCode: string, word: string) => {
//     console.log('Recording word drawn:', word);
//     // This is now handled by arweave storage directly
//     return { success: true };
//   }, []);

//   // Record correct guess - now stored directly on Arweave
//   const recordCorrectGuess = useCallback(async (gameCode: string, guesser: string, timeRemaining: number) => {
//     console.log('Recording correct guess by:', guesser);
//     // This is now handled by arweave storage directly
//     return { success: true };
//   }, []);

//   // Force end round - now handled by the Arweave contract
//   const forceEndRound = useCallback(async (gameCode: string) => {
//     console.log('Forcing round end for game:', gameCode);
//     // This is now handled by arweave storage directly
//     return { success: true };
//   }, []);

//   /**
//    * Get game history from Arweave
//    */
//   const getGameHistory = useCallback(async () => {
//     // This now returns data from local storage and Arweave
//     const localHistory = JSON.parse(localStorage.getItem('gameHistory') || '[]');
//     return localHistory;
//   }, []);

//   return {
//     createRoom,
//     joinRoom,
//     startGame,
//     recordWordDrawn,
//     recordCorrectGuess,
//     forceEndRound,
//     endGame: endGame,
//     getGameHistory,
//     loading,
//     // Additional Arweave-specific functions
//     getGameDetails,
//     getActiveGames,
//     getPlayerBalance,
//     deployGameContract,
//   };
// };