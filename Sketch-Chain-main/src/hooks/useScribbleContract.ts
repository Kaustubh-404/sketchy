
// // src/hooks/useScribbleContract.ts
// import { useState } from 'react';
// import { 
//   useAccount, 
//   useWriteContract,
//   usePublicClient,
// } from 'wagmi';
// import { parseEther, Address, getAddress, formatEther } from 'viem';
// import { SCRIBBLE_CONTRACT_ADDRESS, SCRIBBLE_CONTRACT_ABI } from '@/config/contract';
// import { toast } from 'react-hot-toast';

// interface RoomDetails {
//   roomCreator: Address;
//   wagerAmount: bigint;
//   maxPlayers: bigint;
//   currentPlayerCount: bigint;
//   isActive: boolean;
//   winner: Address;
//   totalPot: bigint;
//   gameEnded: boolean;
// }

// interface GameHistory {
//   gameCode: string;
//   winner: Address;
//   prizeAmount: bigint;
//   timestamp: bigint;
// }

// interface TransactionResult {
//   hash: `0x${string}`;
// }

// export const useScribbleContract = () => {
//   const { address: userAddress } = useAccount();
//   const publicClient = usePublicClient();
//   const [loading, setLoading] = useState(false);
//   const { writeContractAsync } = useWriteContract();

//   const waitForTransaction = async (hash: `0x${string}`) => {
//     if (!publicClient) throw new Error('No public client');
//     return await publicClient.waitForTransactionReceipt({ hash });
//   };

//   const createRoom = async (maxPlayers: number, wagerAmount: string, playerName: string) => {
//     try {
//       setLoading(true);
//       if (!userAddress || !publicClient) throw new Error('Wallet not connected');

//       // Input validation
//       if (maxPlayers < 2 || maxPlayers > 8) {
//         throw new Error('Number of players must be between 2 and 8');
//       }

//       if (parseFloat(wagerAmount) <= 0) {
//         throw new Error('Wager amount must be greater than 0');
//       }

//       if (!playerName || playerName.trim().length < 2) {
//         throw new Error('Player name must be at least 2 characters');
//       }

//       const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
//       // Convert from ETH to Wei properly
//       let wagerInWei;
//       try {
//         wagerInWei = parseEther(wagerAmount);
//         console.log('Wager in Wei:', wagerInWei.toString());
//       } catch (error) {
//         console.error('Error parsing ether amount:', error);
//         throw new Error(`Invalid ether amount: ${wagerAmount}. Please enter a valid number.`);
//       }

//       console.log('Creating room with params:', { 
//         gameCode, 
//         wagerInWei: wagerInWei.toString(), 
//         maxPlayers, 
//         playerName 
//       });

//       // Save player name to localStorage
//       localStorage.setItem('playerName', playerName);

//       try {
//         // Try with player name parameter first
//         const hash = await writeContractAsync({
//           address: SCRIBBLE_CONTRACT_ADDRESS,
//           abi: SCRIBBLE_CONTRACT_ABI,
//           functionName: 'createRoom',
//           args: [gameCode, wagerInWei, BigInt(maxPlayers), playerName],
//           value: wagerInWei
//         });

//         console.log('Create room transaction hash:', hash);
//         await waitForTransaction(hash);
        
//         toast.success('Room created successfully!', {style: { zIndex: 9999 }});
//         return gameCode;
//       } catch (error: any) {
//         console.error('Error with player name parameter, trying without:', error);
        
//         // If the above fails, try without player name parameter
//         if (error.message.includes('invalid method signature') || 
//             error.message.includes('function signature not found') ||
//             error.message.includes('reverted')) {
          
//           const hash = await writeContractAsync({
//             address: SCRIBBLE_CONTRACT_ADDRESS,
//             abi: SCRIBBLE_CONTRACT_ABI,
//             functionName: 'createRoom',
//             args: [gameCode, wagerInWei, BigInt(maxPlayers)],
//             value: wagerInWei
//           });

//           console.log('Create room transaction hash (without player name):', hash);
//           await waitForTransaction(hash);
          
//           toast.success('Room created successfully!');
//           return gameCode;
//         } else {
//           throw error;
//         }
//       }
//     } catch (error: any) {
//       console.error('Error creating room:', error);
//       if (error.message.includes('insufficient funds')) {
//         toast.error('Insufficient funds to create room');
//       } else {
//         toast.error(error.message || 'Failed to create room');
//       }
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   };

//   const joinRoom = async (gameCode: string, playerName: string) => {
//     try {
//       setLoading(true);
//       if (!userAddress || !publicClient) throw new Error('Wallet not connected');

//       if (gameCode.length !== 6) {
//         throw new Error('Invalid game code format');
//       }

//       // Get room details first to check wager amount
//       const roomDetails = await getRoomDetails(gameCode);
//       if (!roomDetails) {
//         throw new Error('Failed to get room details');
//       }
      
//       const wagerAmount = roomDetails.wagerAmount;

//       console.log('Attempting to join room:', gameCode, 'with wager:', formatEther(wagerAmount));
      
//       try {
//         // Try joining with player name
//         const hash = await writeContractAsync({
//           address: SCRIBBLE_CONTRACT_ADDRESS,
//           abi: SCRIBBLE_CONTRACT_ABI,
//           functionName: 'joinRoom',
//           args: [gameCode, playerName],
//           value: wagerAmount
//         });

//         console.log('Join room transaction hash:', hash);
//         await waitForTransaction(hash);
        
//         toast.success('Joined room successfully!');
//       } catch (error: any) {
//         console.error('Error with player name parameter, trying without:', error);
        
//         // If the above fails, try without player name
//         if (error.message.includes('invalid method signature') || 
//             error.message.includes('function signature not found') ||
//             error.message.includes('reverted')) {
          
//           const hash = await writeContractAsync({
//             address: SCRIBBLE_CONTRACT_ADDRESS,
//             abi: SCRIBBLE_CONTRACT_ABI,
//             functionName: 'joinRoom',
//             args: [gameCode],
//             value: wagerAmount
//           });

//           console.log('Join room transaction hash (without player name):', hash);
//           await waitForTransaction(hash);
          
//           toast.success('Joined room successfully!');
//         } else {
//           throw error;
//         }
//       }
//     } catch (error: any) {
//       console.error('Error joining room:', error);
      
//       if (error.message.includes('insufficient funds')) {
//         toast.error('Insufficient funds to join the room');
//       } else if (error.message.includes('Player already in room')) {
//         toast.error('You are already in this room');
//       } else if (error.message.includes('Room is full')) {
//         toast.error('Room is full');
//       } else if (error.message.includes('Game has already started') || error.message.includes('Game has already ended')) {
//         toast.error('Game has already started');
//       } else if (error.message.includes('Room is not active')) {
//         toast.error('Room is not active');
//       } else {
//         toast.error('Failed to join room. Please try again.');
//       }
      
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   };

//   const getRoomDetails = async (gameCode: string): Promise<RoomDetails | null> => {
//     try {
//       if (!publicClient) throw new Error('No public client');
      
//       console.log('Fetching room details for:', gameCode);
  
//       // Use proper typing for the contract return value
//       const result = await publicClient.readContract({
//         address: SCRIBBLE_CONTRACT_ADDRESS,
//         abi: SCRIBBLE_CONTRACT_ABI,
//         functionName: 'getRoomDetails',
//         args: [gameCode]
//       });
      
//       // Type assertion to handle tuple return type
//       const details = result as readonly [
//         Address,    // roomCreator
//         bigint,     // wagerAmount
//         bigint,     // maxPlayers
//         bigint,     // currentPlayerCount
//         boolean,    // isActive
//         Address,    // winner
//         bigint,     // totalPot
//         boolean     // gameEnded
//       ];
  
//       // Safely extract values from the tuple
//       const roomDetails: RoomDetails = {
//         roomCreator: details[0],
//         wagerAmount: details[1],
//         maxPlayers: details[2],
//         currentPlayerCount: details[3],
//         isActive: details[4],
//         winner: details[5],
//         totalPot: details[6],
//         gameEnded: details[7]
//       };
  
//       console.log('Room details:', roomDetails);
//       return roomDetails;
//     } catch (error: unknown) {
//       console.error('Error fetching room details:', error);
//       return null;
//     }
//   };

//   const getPlayerName = async (gameCode: string, player: string): Promise<string | null> => {
//     try {
//       if (!publicClient) throw new Error('No public client');
      
//       console.log('Fetching player name for:', player, 'in game:', gameCode);

//       const playerName = await publicClient.readContract({
//         address: SCRIBBLE_CONTRACT_ADDRESS,
//         abi: SCRIBBLE_CONTRACT_ABI,
//         functionName: 'getPlayerName',
//         args: [gameCode, getAddress(player)]
//       }) as string;

//       return playerName;
//     } catch (error: unknown) {
//       console.error('Error fetching player name:', error);
//       return null;
//     }
//   };

//   const getRoomPlayers = async (gameCode: string): Promise<Address[]> => {
//     try {
//       if (!publicClient) throw new Error('No public client');
      
//       console.log('Fetching players for room:', gameCode);

//       const players = await publicClient.readContract({
//         address: SCRIBBLE_CONTRACT_ADDRESS,
//         abi: SCRIBBLE_CONTRACT_ABI,
//         functionName: 'getRoomPlayers',
//         args: [gameCode]
//       }) as Address[];

//       console.log('Room players:', players);
//       return players;
//     } catch (error: unknown) {
//       console.error('Error fetching room players:', error);
//       return [];
//     }
//   };

//   const getActiveRoomCodes = async (): Promise<string[]> => {
//     try {
//       if (!publicClient) throw new Error('No public client');
      
//       console.log('Fetching active room codes');

//       const roomCodes = await publicClient.readContract({
//         address: SCRIBBLE_CONTRACT_ADDRESS,
//         abi: SCRIBBLE_CONTRACT_ABI,
//         functionName: 'getActiveRoomCodes',
//         args: []
//       }) as string[];

//       console.log('Active room codes:', roomCodes);
//       return roomCodes;
//     } catch (error: unknown) {
//       console.error('Error fetching active room codes:', error);
//       return [];
//     }
//   };

//   // The following functions are kept for compatibility but have minimal functionality with the simplified contract
  
//   const startGame = async (gameCode: string) => {
//     // Just log this since the backend will handle starting the game
//     console.log('Game starting:', gameCode);
//     // No blockchain interaction needed
//     return { success: true };
//   };
  
//   const recordWordDrawn = async (gameCode: string, word: string) => {
//     // Just log this since the backend will handle recording the word
//     console.log('Word drawn:', word);
//     // No blockchain interaction needed
//     return { success: true };
//   };
  
//   const recordCorrectGuess = async (gameCode: string, guesser: string, timeRemaining: number) => {
//     // Just log this since the backend will handle recording guesses
//     console.log('Correct guess by:', guesser, 'Time remaining:', timeRemaining);
//     // No blockchain interaction needed
//     return { success: true };
//   };
  
//   const forceEndRound = async (gameCode: string) => {
//     // Just log this since the backend will handle ending rounds
//     console.log('Forcing round end for game:', gameCode);
//     // No blockchain interaction needed
//     return { success: true };
//   };

//   const endGame = async (gameCode: string): Promise<TransactionResult> => {
//     // This is now handled by the backend
//     console.log(gameCode)
//     console.log('Game ended automatically by contract');
//     // Return a dummy result since this won't be used
//     return { hash: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}` };
//   };

//   const getGameHistory = async (): Promise<GameHistory[]> => {
//     // Return data from localStorage
//     const history = JSON.parse(localStorage.getItem('gameHistory') || '[]');
//     return history;
//   };

//   return {
//     createRoom,
//     joinRoom,
//     startGame,
//     recordWordDrawn,
//     recordCorrectGuess,
//     forceEndRound,
//     getRoomDetails,
//     getPlayerName,
//     getRoomPlayers,
//     getActiveRoomCodes,
//     endGame,
//     getGameHistory,
//     loading,
//   };
// };




import { useState } from 'react';
import { 
  useAccount, 
  useWriteContract,
  usePublicClient,
} from 'wagmi';
import { parseEther, Address, getAddress, formatEther } from 'viem';
import { SCRIBBLE_CONTRACT_ADDRESS, SCRIBBLE_CONTRACT_ABI } from '@/config/contract';
import { toast } from 'react-hot-toast';

interface RoomDetails {
  roomCreator: Address;
  wagerAmount: bigint;
  maxPlayers: bigint;
  currentPlayerCount: bigint;
  isActive: boolean;
  winner: Address;
  totalPot: bigint;
  gameEnded: boolean;
}

interface GameHistory {
  gameCode: string;
  winner: Address;
  prizeAmount: bigint;
  timestamp: bigint;
}

interface TransactionResult {
  hash: `0x${string}`;
}

// Helper function to safely get error message
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const useScribbleContract = () => {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const [loading, setLoading] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const waitForTransaction = async (hash: `0x${string}`) => {
    if (!publicClient) throw new Error('No public client');
    return await publicClient.waitForTransactionReceipt({ hash });
  };

  const createRoom = async (maxPlayers: number, wagerAmount: string, playerName: string) => {
    try {
      setLoading(true);
      if (!userAddress || !publicClient) throw new Error('Wallet not connected');

      // Input validation
      if (maxPlayers < 2 || maxPlayers > 8) {
        throw new Error('Number of players must be between 2 and 8');
      }

      if (parseFloat(wagerAmount) <= 0) {
        throw new Error('Wager amount must be greater than 0');
      }

      if (!playerName || playerName.trim().length < 2) {
        throw new Error('Player name must be at least 2 characters');
      }

      const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Convert from ETH to Wei properly
      let wagerInWei;
      try {
        wagerInWei = parseEther(wagerAmount);
        console.log('Wager in Wei:', wagerInWei.toString());
      } catch (error) {
        console.error('Error parsing ether amount:', error);
        throw new Error(`Invalid ether amount: ${wagerAmount}. Please enter a valid number.`);
      }

      console.log('Creating room with params:', { 
        gameCode, 
        wagerInWei: wagerInWei.toString(), 
        maxPlayers, 
        playerName 
      });

      // Save player name to localStorage
      localStorage.setItem('playerName', playerName);

      try {
        // Try with player name parameter first
        const hash = await writeContractAsync({
          address: SCRIBBLE_CONTRACT_ADDRESS,
          abi: SCRIBBLE_CONTRACT_ABI,
          functionName: 'createRoom',
          args: [gameCode, wagerInWei, BigInt(maxPlayers), playerName],
          value: wagerInWei
        });

        console.log('Create room transaction hash:', hash);
        await waitForTransaction(hash);
        
        toast.success('Room created successfully!', {style: { zIndex: 9999 }});
        return gameCode;
      } catch (error: unknown) {
        console.error('Error with player name parameter, trying without:', error);
        
        const errorMessage = getErrorMessage(error);
        
        // If the above fails, try without player name parameter
        if (errorMessage.includes('invalid method signature') || 
            errorMessage.includes('function signature not found') ||
            errorMessage.includes('reverted')) {
          
          const hash = await writeContractAsync({
            address: SCRIBBLE_CONTRACT_ADDRESS,
            abi: SCRIBBLE_CONTRACT_ABI,
            functionName: 'createRoom',
            args: [gameCode, wagerInWei, BigInt(maxPlayers)],
            value: wagerInWei
          });

          console.log('Create room transaction hash (without player name):', hash);
          await waitForTransaction(hash);
          
          toast.success('Room created successfully!');
          return gameCode;
        } else {
          throw error;
        }
      }
    } catch (error: unknown) {
      console.error('Error creating room:', error);
      const errorMessage = getErrorMessage(error);
      
      if (errorMessage.includes('insufficient funds')) {
        toast.error('Insufficient funds to create room');
      } else {
        toast.error(errorMessage || 'Failed to create room');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (gameCode: string, playerName: string) => {
    try {
      setLoading(true);
      if (!userAddress || !publicClient) throw new Error('Wallet not connected');

      if (gameCode.length !== 6) {
        throw new Error('Invalid game code format');
      }

      // Get room details first to check wager amount
      const roomDetails = await getRoomDetails(gameCode);
      if (!roomDetails) {
        throw new Error('Failed to get room details');
      }
      
      const wagerAmount = roomDetails.wagerAmount;

      console.log('Attempting to join room:', gameCode, 'with wager:', formatEther(wagerAmount));
      
      try {
        // Try joining with player name
        const hash = await writeContractAsync({
          address: SCRIBBLE_CONTRACT_ADDRESS,
          abi: SCRIBBLE_CONTRACT_ABI,
          functionName: 'joinRoom',
          args: [gameCode, playerName],
          value: wagerAmount
        });

        console.log('Join room transaction hash:', hash);
        await waitForTransaction(hash);
        
        toast.success('Joined room successfully!');
      } catch (error: unknown) {
        console.error('Error with player name parameter, trying without:', error);
        
        const errorMessage = getErrorMessage(error);
        
        // If the above fails, try without player name
        if (errorMessage.includes('invalid method signature') || 
            errorMessage.includes('function signature not found') ||
            errorMessage.includes('reverted')) {
          
          const hash = await writeContractAsync({
            address: SCRIBBLE_CONTRACT_ADDRESS,
            abi: SCRIBBLE_CONTRACT_ABI,
            functionName: 'joinRoom',
            args: [gameCode],
            value: wagerAmount
          });

          console.log('Join room transaction hash (without player name):', hash);
          await waitForTransaction(hash);
          
          toast.success('Joined room successfully!');
        } else {
          throw error;
        }
      }
    } catch (error: unknown) {
      console.error('Error joining room:', error);
      const errorMessage = getErrorMessage(error);
      
      if (errorMessage.includes('insufficient funds')) {
        toast.error('Insufficient funds to join the room');
      } else if (errorMessage.includes('Player already in room')) {
        toast.error('You are already in this room');
      } else if (errorMessage.includes('Room is full')) {
        toast.error('Room is full');
      } else if (errorMessage.includes('Game has already started') || errorMessage.includes('Game has already ended')) {
        toast.error('Game has already started');
      } else if (errorMessage.includes('Room is not active')) {
        toast.error('Room is not active');
      } else {
        toast.error('Failed to join room. Please try again.');
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getRoomDetails = async (gameCode: string): Promise<RoomDetails | null> => {
    try {
      if (!publicClient) throw new Error('No public client');
      
      console.log('Fetching room details for:', gameCode);
  
      // Use proper typing for the contract return value
      const result = await publicClient.readContract({
        address: SCRIBBLE_CONTRACT_ADDRESS,
        abi: SCRIBBLE_CONTRACT_ABI,
        functionName: 'getRoomDetails',
        args: [gameCode]
      });
      
      // Type assertion to handle tuple return type
      const details = result as readonly [
        Address,    // roomCreator
        bigint,     // wagerAmount
        bigint,     // maxPlayers
        bigint,     // currentPlayerCount
        boolean,    // isActive
        Address,    // winner
        bigint,     // totalPot
        boolean     // gameEnded
      ];
  
      // Safely extract values from the tuple
      const roomDetails: RoomDetails = {
        roomCreator: details[0],
        wagerAmount: details[1],
        maxPlayers: details[2],
        currentPlayerCount: details[3],
        isActive: details[4],
        winner: details[5],
        totalPot: details[6],
        gameEnded: details[7]
      };
  
      console.log('Room details:', roomDetails);
      return roomDetails;
    } catch (error: unknown) {
      console.error('Error fetching room details:', error);
      return null;
    }
  };

  const getPlayerName = async (gameCode: string, player: string): Promise<string | null> => {
    try {
      if (!publicClient) throw new Error('No public client');
      
      console.log('Fetching player name for:', player, 'in game:', gameCode);

      const playerName = await publicClient.readContract({
        address: SCRIBBLE_CONTRACT_ADDRESS,
        abi: SCRIBBLE_CONTRACT_ABI,
        functionName: 'getPlayerName',
        args: [gameCode, getAddress(player)]
      }) as string;

      return playerName;
    } catch (error: unknown) {
      console.error('Error fetching player name:', error);
      return null;
    }
  };

  const getRoomPlayers = async (gameCode: string): Promise<Address[]> => {
    try {
      if (!publicClient) throw new Error('No public client');
      
      console.log('Fetching players for room:', gameCode);

      const players = await publicClient.readContract({
        address: SCRIBBLE_CONTRACT_ADDRESS,
        abi: SCRIBBLE_CONTRACT_ABI,
        functionName: 'getRoomPlayers',
        args: [gameCode]
      }) as Address[];

      console.log('Room players:', players);
      return players;
    } catch (error: unknown) {
      console.error('Error fetching room players:', error);
      return [];
    }
  };

  const getActiveRoomCodes = async (): Promise<string[]> => {
    try {
      if (!publicClient) throw new Error('No public client');
      
      console.log('Fetching active room codes');

      const roomCodes = await publicClient.readContract({
        address: SCRIBBLE_CONTRACT_ADDRESS,
        abi: SCRIBBLE_CONTRACT_ABI,
        functionName: 'getActiveRoomCodes',
        args: []
      }) as string[];

      console.log('Active room codes:', roomCodes);
      return roomCodes;
    } catch (error: unknown) {
      console.error('Error fetching active room codes:', error);
      return [];
    }
  };

  // The following functions are kept for compatibility but have minimal functionality with the simplified contract
  
  const startGame = async (gameCode: string) => {
    // Just log this since the backend will handle starting the game
    console.log('Game starting:', gameCode);
    // No blockchain interaction needed
    return { success: true };
  };
  
  const recordWordDrawn = async (gameCode: string, word: string) => {
    // Just log this since the backend will handle recording the word
    console.log('Word drawn:', word);
    // No blockchain interaction needed
    return { success: true };
  };
  
  const recordCorrectGuess = async (gameCode: string, guesser: string, timeRemaining: number) => {
    // Just log this since the backend will handle recording guesses
    console.log('Correct guess by:', guesser, 'Time remaining:', timeRemaining);
    // No blockchain interaction needed
    return { success: true };
  };
  
  const forceEndRound = async (gameCode: string) => {
    // Just log this since the backend will handle ending rounds
    console.log('Forcing round end for game:', gameCode);
    // No blockchain interaction needed
    return { success: true };
  };

  const endGame = async (gameCode: string): Promise<TransactionResult> => {
    // This is now handled by the backend
    console.log(gameCode)
    console.log('Game ended automatically by contract');
    // Return a dummy result since this won't be used
    return { hash: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}` };
  };

  const getGameHistory = async (): Promise<GameHistory[]> => {
    // Return data from localStorage
    const history = JSON.parse(localStorage.getItem('gameHistory') || '[]');
    return history;
  };

  return {
    createRoom,
    joinRoom,
    startGame,
    recordWordDrawn,
    recordCorrectGuess,
    forceEndRound,
    getRoomDetails,
    getPlayerName,
    getRoomPlayers,
    getActiveRoomCodes,
    endGame,
    getGameHistory,
    loading,
  };
};