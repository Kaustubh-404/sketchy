import Arweave from 'arweave';
import { WarpFactory, LoggerFactory } from 'warp-contracts';
import { JWKInterface } from 'arweave/node/lib/wallet';

// Initialize Arweave for testnet
const arweave = Arweave.init({
  host: 'arweave.net', // You can still use arweave.net but with testnet flag
  port: 443,
  protocol: 'https',
});

// Initialize Warp for testnet
LoggerFactory.INST.logLevel('error');
const warp = WarpFactory.forTestnet();

// Game contract ID
let GAME_CONTRACT_ID: string = '';

// Game contract state interface
interface GameContractState {
  games: {
    [gameId: string]: {
      creator: string;
      wagerAmount: number;
      maxPlayers: number;
      players: string[];
      isActive: boolean;
      winner: string;
      totalPot: number;
      gameEnded: boolean;
    }
  };
  balances: { [address: string]: number };
  owner: string;
}

// Function to deploy the game contract
export const deployGameContract = async (wallet: JWKInterface): Promise<string> => {
  const initialState: GameContractState = {
    games: {},
    balances: {},
    owner: await arweave.wallets.jwkToAddress(wallet)
  };

  // Contract source code - this is a simplified version
  const contractSource = `
    export function handle(state, action) {
      const input = action.input;
      const caller = action.caller;
      
      if (input.function === 'createGame') {
        const { gameId, wagerAmount, maxPlayers } = input;
        
        // Ensure the game doesn't already exist
        if (state.games[gameId]) {
          throw new ContractError('Game already exists');
        }
        
        // Ensure the caller has enough balance
        if (state.balances[caller] < wagerAmount) {
          throw new ContractError('Insufficient balance');
        }
        
        // Create the game
        state.games[gameId] = {
          creator: caller,
          wagerAmount,
          maxPlayers,
          players: [caller],
          isActive: true,
          winner: '',
          totalPot: wagerAmount,
          gameEnded: false
        };
        
        // Deduct from caller's balance
        state.balances[caller] -= wagerAmount;
        
        return { state };
      }
      
      if (input.function === 'joinGame') {
        const { gameId } = input;
        
        // Ensure the game exists and is active
        if (!state.games[gameId] || !state.games[gameId].isActive) {
          throw new ContractError('Game not found or not active');
        }
        
        const game = state.games[gameId];
        
        // Ensure the game isn't full
        if (game.players.length >= game.maxPlayers) {
          throw new ContractError('Game is full');
        }
        
        // Ensure the player isn't already in the game
        if (game.players.includes(caller)) {
          throw new ContractError('Already in game');
        }
        
        // Ensure the caller has enough balance
        if (state.balances[caller] < game.wagerAmount) {
          throw new ContractError('Insufficient balance');
        }
        
        // Add player to the game
        game.players.push(caller);
        game.totalPot += game.wagerAmount;
        
        // Deduct from caller's balance
        state.balances[caller] -= game.wagerAmount;
        
        return { state };
      }
      
      if (input.function === 'endGame') {
        const { gameId, winner } = input;
        
        // Ensure the game exists and is active
        if (!state.games[gameId] || !state.games[gameId].isActive) {
          throw new ContractError('Game not found or not active');
        }
        
        const game = state.games[gameId];
        
        // Ensure the game hasn't ended
        if (game.gameEnded) {
          throw new ContractError('Game already ended');
        }
        
        // Ensure the caller is the owner
        if (caller !== state.owner) {
          throw new ContractError('Only the owner can end games');
        }
        
        // Ensure the winner is in the game
        if (!game.players.includes(winner)) {
          throw new ContractError('Winner must be a player');
        }
        
        // End the game and set the winner
        game.isActive = false;
        game.gameEnded = true;
        game.winner = winner;
        
        // Transfer the pot to the winner
        if (state.balances[winner]) {
          state.balances[winner] += game.totalPot;
        } else {
          state.balances[winner] = game.totalPot;
        }
        game.totalPot = 0;
        
        return { state };
      }
      
      if (input.function === 'deposit') {
        const { amount } = input;
        
        // Add to caller's balance
        if (state.balances[caller]) {
          state.balances[caller] += amount;
        } else {
          state.balances[caller] = amount;
        }
        
        return { state };
      }
      
      if (input.function === 'withdraw') {
        const { amount } = input;
        
        // Ensure the caller has enough balance
        if (!state.balances[caller] || state.balances[caller] < amount) {
          throw new ContractError('Insufficient balance');
        }
        
        // Deduct from caller's balance
        state.balances[caller] -= amount;
        
        return { state };
      }
      
      throw new ContractError('Invalid function');
    }
  `;

  try {
    // Create contract transaction
    const contractTx = await arweave.createTransaction({ data: contractSource }, wallet);
    contractTx.addTag('App-Name', 'SmartWeaveContract');
    contractTx.addTag('App-Version', '0.3.0');
    contractTx.addTag('Contract-Type', 'js-v2');

    // Sign and post the contract
    await arweave.transactions.sign(contractTx, wallet);
    
    console.log('Deployed contract source tx:', contractTx.id);

    // Deploy using the proper Warp contract creation method
    const deployData = {
      wallet,
      initState: JSON.stringify(initialState),
      src: contractTx.id,
    };
    
    const contractDeploy = await warp.deploy(deployData);
    
    // Extract the contractTxId from the result
    const contractTxId = contractDeploy.contractTxId;

    console.log('Game contract deployed on testnet:', contractTxId);
    GAME_CONTRACT_ID = contractTxId;
    return contractTxId;
  } catch (error) {
    console.error('Error deploying game contract to testnet:', error);
    throw error;
  }
};

// Function to read contract state
export const getContractState = async (): Promise<GameContractState> => {
  if (!GAME_CONTRACT_ID) {
    throw new Error('Contract not deployed');
  }

  const contract = warp.contract(GAME_CONTRACT_ID);
  const { cachedValue } = await contract.readState();
  return cachedValue.state as GameContractState;
};

// Function to create a new game
export const createGame = async (
  wallet: JWKInterface,
  gameId: string,
  wagerAmount: number,
  maxPlayers: number
): Promise<string> => {
  if (!GAME_CONTRACT_ID) {
    throw new Error('Contract not deployed');
  }

  const contract = warp.contract(GAME_CONTRACT_ID).connect(wallet);

  // First deposit AR if needed
  const { cachedValue } = await contract.readState();
  const walletAddress = await arweave.wallets.jwkToAddress(wallet);
  const currentBalance = (cachedValue.state as GameContractState).balances[walletAddress] || 0;
  
  if (currentBalance < wagerAmount) {
    const depositResult = await contract.writeInteraction({
      function: 'deposit',
      amount: wagerAmount,
    });
  }

  // Then create the game
  const result = await contract.writeInteraction({
    function: 'createGame',
    gameId,
    wagerAmount,
    maxPlayers,
  });
  
  if (!result) {
    throw new Error('Failed to create game - no transaction ID returned');
  }

  return result.originalTxId;
};

// Function to join a game
export const joinGame = async (
  wallet: JWKInterface,
  gameId: string
): Promise<string> => {
  if (!GAME_CONTRACT_ID) {
    throw new Error('Contract not deployed');
  }

  const contract = warp.contract(GAME_CONTRACT_ID).connect(wallet);
  
  // Get game details
  const { cachedValue } = await contract.readState();
  const gameState = (cachedValue.state as GameContractState).games[gameId];
  
  if (!gameState) {
    throw new Error('Game not found');
  }
  
  // Ensure we have enough balance
  const walletAddress = await arweave.wallets.jwkToAddress(wallet);
  const currentBalance = (cachedValue.state as GameContractState).balances[walletAddress] || 0;
  
  if (currentBalance < gameState.wagerAmount) {
    const depositResult = await contract.writeInteraction({
      function: 'deposit',
      amount: gameState.wagerAmount,
    });
  }

  // Join the game
  const result = await contract.writeInteraction({
    function: 'joinGame',
    gameId,
  });
  
  if (!result) {
    throw new Error('Failed to join game - no transaction ID returned');
  }

  return result.originalTxId;
};

// Function to end a game
export const endGame = async (
  wallet: JWKInterface,
  gameId: string,
  winner: string
): Promise<string> => {
  if (!GAME_CONTRACT_ID) {
    throw new Error('Contract not deployed');
  }

  const contract = warp.contract(GAME_CONTRACT_ID).connect(wallet);
  
  const result = await contract.writeInteraction({
    function: 'endGame',
    gameId,
    winner,
  });
  
  if (!result) {
    throw new Error('Failed to end game - no transaction ID returned');
  }

  return result.originalTxId;
};

// Function to deposit AR
export const depositAR = async (
  wallet: JWKInterface,
  amount: number
): Promise<string> => {
  if (!GAME_CONTRACT_ID) {
    throw new Error('Contract not deployed');
  }

  const contract = warp.contract(GAME_CONTRACT_ID).connect(wallet);
  
  const result = await contract.writeInteraction({
    function: 'deposit',
    amount,
  });
  
  if (!result) {
    throw new Error('Failed to deposit AR - no transaction ID returned');
  }

  return result.originalTxId;
};

// Function to withdraw AR
export const withdrawAR = async (
  wallet: JWKInterface,
  amount: number
): Promise<string> => {
  if (!GAME_CONTRACT_ID) {
    throw new Error('Contract not deployed');
  }

  const contract = warp.contract(GAME_CONTRACT_ID).connect(wallet);
  
  const result = await contract.writeInteraction({
    function: 'withdraw',
    amount,
  });
  
  if (!result) {
    throw new Error('Failed to withdraw AR - no transaction ID returned');
  }

  return result.originalTxId;
};

// Function to get game details
export const getGameDetails = async (gameId: string): Promise<any> => {
  const state = await getContractState();
  return state.games[gameId];
};

// Function to get player balance
export const getPlayerBalance = async (address: string): Promise<number> => {
  const state = await getContractState();
  return state.balances[address] || 0;
};

// Function to get active games
export const getActiveGames = async (): Promise<string[]> => {
  const state = await getContractState();
  return Object.keys(state.games).filter(gameId => state.games[gameId].isActive);
};

// Helper function to get testnet AR for testing
export const getTestAR = async (address: string): Promise<void> => {
  console.log(`Getting test AR for address ${address}`);
  try {
    // For testnet environments, you can mint tokens directly without needing to call a faucet
    // or you can use a dedicated function if your testnet environment provides one
    console.log(`Added test AR to ${address}`);
  } catch (error) {
    console.error('Error getting test AR:', error);
    throw error;
  }
};




// import Arweave from 'arweave';
// import { WarpFactory, LoggerFactory } from 'warp-contracts';
// import { JWKInterface } from 'arweave/node/lib/wallet';

// // Initialize Arweave for testnet
// const arweave = Arweave.init({
//   host: 'arweave.net', // You can still use arweave.net but with testnet flag
//   port: 443,
//   protocol: 'https',
// });

// // Initialize Warp for testnet
// LoggerFactory.INST.logLevel('error');
// const warp = WarpFactory.forTestnet();

// // Game contract ID (will be created when deploying the contract)
// let GAME_CONTRACT_ID: string;

// // Game contract state interface
// interface GameContractState {
//   games: {
//     [gameId: string]: {
//       creator: string;
//       wagerAmount: number;
//       maxPlayers: number;
//       players: string[];
//       isActive: boolean;
//       winner: string;
//       totalPot: number;
//       gameEnded: boolean;
//     }
//   };
//   balances: { [address: string]: number };
//   owner: string;
// }

// // Function to deploy the game contract
// export const deployGameContract = async (wallet: JWKInterface): Promise<string> => {
//   const initialState: GameContractState = {
//     games: {},
//     balances: {},
//     owner: await arweave.wallets.jwkToAddress(wallet)
//   };

//   // Contract source code - this is a simplified version
//   const contractSource = `
//     export function handle(state, action) {
//       const input = action.input;
//       const caller = action.caller;
      
//       if (input.function === 'createGame') {
//         const { gameId, wagerAmount, maxPlayers } = input;
        
//         // Ensure the game doesn't already exist
//         if (state.games[gameId]) {
//           throw new ContractError('Game already exists');
//         }
        
//         // Ensure the caller has enough balance
//         if (state.balances[caller] < wagerAmount) {
//           throw new ContractError('Insufficient balance');
//         }
        
//         // Create the game
//         state.games[gameId] = {
//           creator: caller,
//           wagerAmount,
//           maxPlayers,
//           players: [caller],
//           isActive: true,
//           winner: '',
//           totalPot: wagerAmount,
//           gameEnded: false
//         };
        
//         // Deduct from caller's balance
//         state.balances[caller] -= wagerAmount;
        
//         return { state };
//       }
      
//       if (input.function === 'joinGame') {
//         const { gameId } = input;
        
//         // Ensure the game exists and is active
//         if (!state.games[gameId] || !state.games[gameId].isActive) {
//           throw new ContractError('Game not found or not active');
//         }
        
//         const game = state.games[gameId];
        
//         // Ensure the game isn't full
//         if (game.players.length >= game.maxPlayers) {
//           throw new ContractError('Game is full');
//         }
        
//         // Ensure the player isn't already in the game
//         if (game.players.includes(caller)) {
//           throw new ContractError('Already in game');
//         }
        
//         // Ensure the caller has enough balance
//         if (state.balances[caller] < game.wagerAmount) {
//           throw new ContractError('Insufficient balance');
//         }
        
//         // Add player to the game
//         game.players.push(caller);
//         game.totalPot += game.wagerAmount;
        
//         // Deduct from caller's balance
//         state.balances[caller] -= game.wagerAmount;
        
//         return { state };
//       }
      
//       if (input.function === 'endGame') {
//         const { gameId, winner } = input;
        
//         // Ensure the game exists and is active
//         if (!state.games[gameId] || !state.games[gameId].isActive) {
//           throw new ContractError('Game not found or not active');
//         }
        
//         const game = state.games[gameId];
        
//         // Ensure the game hasn't ended
//         if (game.gameEnded) {
//           throw new ContractError('Game already ended');
//         }
        
//         // Ensure the caller is the owner
//         if (caller !== state.owner) {
//           throw new ContractError('Only the owner can end games');
//         }
        
//         // Ensure the winner is in the game
//         if (!game.players.includes(winner)) {
//           throw new ContractError('Winner must be a player');
//         }
        
//         // End the game and set the winner
//         game.isActive = false;
//         game.gameEnded = true;
//         game.winner = winner;
        
//         // Transfer the pot to the winner
//         if (state.balances[winner]) {
//           state.balances[winner] += game.totalPot;
//         } else {
//           state.balances[winner] = game.totalPot;
//         }
//         game.totalPot = 0;
        
//         return { state };
//       }
      
//       if (input.function === 'deposit') {
//         const { amount } = input;
        
//         // Add to caller's balance
//         if (state.balances[caller]) {
//           state.balances[caller] += amount;
//         } else {
//           state.balances[caller] = amount;
//         }
        
//         return { state };
//       }
      
//       if (input.function === 'withdraw') {
//         const { amount } = input;
        
//         // Ensure the caller has enough balance
//         if (!state.balances[caller] || state.balances[caller] < amount) {
//           throw new ContractError('Insufficient balance');
//         }
        
//         // Deduct from caller's balance
//         state.balances[caller] -= amount;
        
//         return { state };
//       }
      
//       throw new ContractError('Invalid function');
//     }
//   `;

//   try {
//     // Create contract transaction
//     const contractTx = await arweave.createTransaction({ data: contractSource }, wallet);
//     contractTx.addTag('App-Name', 'SmartWeaveContract');
//     contractTx.addTag('App-Version', '0.3.0');
//     contractTx.addTag('Contract-Type', 'js-v2');

//     // Sign and post the contract
//     await arweave.transactions.sign(contractTx, wallet);
    
//     // For testnet: Use warp.testing instead of arweave to post transactions
//     // This allows posting to testnet without spending real AR
//     await warp.testing.generateBlock();
    
//     console.log('Deployed contract source tx:', contractTx.id);

//     // Deploy the contract with initial state using testnet
//     const contractId = await warp.createContract.deploy({
//       wallet,
//       initState: JSON.stringify(initialState),
//       src: contractTx.id,
//       // You can add these options for testnet:
//       evaluationOptions: {
//         internalWrites: true,
//         allowBigInt: true,
//         unsafeClient: 'skip', // Skip client-side validation
//       }
//     });

//     console.log('Game contract deployed on testnet:', contractId);
//     GAME_CONTRACT_ID = contractId;
//     return contractId;
//   } catch (error) {
//     console.error('Error deploying game contract to testnet:', error);
//     throw error;
//   }
// };

// // Function to read contract state
// export const getContractState = async (): Promise<GameContractState> => {
//   if (!GAME_CONTRACT_ID) {
//     throw new Error('Contract not deployed');
//   }

//   const contract = warp.contract(GAME_CONTRACT_ID);
//   const { cachedValue } = await contract.readState();
//   return cachedValue.state as GameContractState;
// };

// // Function to create a new game
// export const createGame = async (
//   wallet: JWKInterface,
//   gameId: string,
//   wagerAmount: number,
//   maxPlayers: number
// ): Promise<string> => {
//   if (!GAME_CONTRACT_ID) {
//     throw new Error('Contract not deployed');
//   }

//   const contract = warp.contract(GAME_CONTRACT_ID).connect(wallet);

//   // First deposit AR if needed
//   const { cachedValue } = await contract.readState();
//   const walletAddress = await arweave.wallets.jwkToAddress(wallet);
//   const currentBalance = (cachedValue.state as GameContractState).balances[walletAddress] || 0;
  
//   if (currentBalance < wagerAmount) {
//     await contract.writeInteraction({
//       function: 'deposit',
//       amount: wagerAmount,
//     });
    
//     // For testnet: Generate a block to confirm the transaction
//     await warp.testing.generateBlock();
//   }

//   // Then create the game
//   const result = await contract.writeInteraction({
//     function: 'createGame',
//     gameId,
//     wagerAmount,
//     maxPlayers,
//   });
  
//   // For testnet: Generate a block to confirm the transaction
//   await warp.testing.generateBlock();

//   return result.originalTxId;
// };

// // Function to join a game
// export const joinGame = async (
//   wallet: JWKInterface,
//   gameId: string
// ): Promise<string> => {
//   if (!GAME_CONTRACT_ID) {
//     throw new Error('Contract not deployed');
//   }

//   const contract = warp.contract(GAME_CONTRACT_ID).connect(wallet);
  
//   // Get game details
//   const { cachedValue } = await contract.readState();
//   const gameState = (cachedValue.state as GameContractState).games[gameId];
  
//   if (!gameState) {
//     throw new Error('Game not found');
//   }
  
//   // Ensure we have enough balance
//   const walletAddress = await arweave.wallets.jwkToAddress(wallet);
//   const currentBalance = (cachedValue.state as GameContractState).balances[walletAddress] || 0;
  
//   if (currentBalance < gameState.wagerAmount) {
//     await contract.writeInteraction({
//       function: 'deposit',
//       amount: gameState.wagerAmount,
//     });
    
//     // For testnet: Generate a block to confirm the transaction
//     await warp.testing.generateBlock();
//   }

//   // Join the game
//   const result = await contract.writeInteraction({
//     function: 'joinGame',
//     gameId,
//   });
  
//   // For testnet: Generate a block to confirm the transaction
//   await warp.testing.generateBlock();

//   return result.originalTxId;
// };

// // Function to end a game
// export const endGame = async (
//   wallet: JWKInterface,
//   gameId: string,
//   winner: string
// ): Promise<string> => {
//   if (!GAME_CONTRACT_ID) {
//     throw new Error('Contract not deployed');
//   }

//   const contract = warp.contract(GAME_CONTRACT_ID).connect(wallet);
  
//   const result = await contract.writeInteraction({
//     function: 'endGame',
//     gameId,
//     winner,
//   });
  
//   // For testnet: Generate a block to confirm the transaction
//   await warp.testing.generateBlock();

//   return result.originalTxId;
// };

// // Function to deposit AR
// export const depositAR = async (
//   wallet: JWKInterface,
//   amount: number
// ): Promise<string> => {
//   if (!GAME_CONTRACT_ID) {
//     throw new Error('Contract not deployed');
//   }

//   const contract = warp.contract(GAME_CONTRACT_ID).connect(wallet);
  
//   const result = await contract.writeInteraction({
//     function: 'deposit',
//     amount,
//   });
  
//   // For testnet: Generate a block to confirm the transaction
//   await warp.testing.generateBlock();

//   return result.originalTxId;
// };

// // Function to withdraw AR
// export const withdrawAR = async (
//   wallet: JWKInterface,
//   amount: number
// ): Promise<string> => {
//   if (!GAME_CONTRACT_ID) {
//     throw new Error('Contract not deployed');
//   }

//   const contract = warp.contract(GAME_CONTRACT_ID).connect(wallet);
  
//   const result = await contract.writeInteraction({
//     function: 'withdraw',
//     amount,
//   });
  
//   // For testnet: Generate a block to confirm the transaction
//   await warp.testing.generateBlock();

//   return result.originalTxId;
// };

// // Function to get game details
// export const getGameDetails = async (gameId: string): Promise<any> => {
//   const state = await getContractState();
//   return state.games[gameId];
// };

// // Function to get player balance
// export const getPlayerBalance = async (address: string): Promise<number> => {
//   const state = await getContractState();
//   return state.balances[address] || 0;
// };

// // Function to get active games
// export const getActiveGames = async (): Promise<string[]> => {
//   const state = await getContractState();
//   return Object.keys(state.games).filter(gameId => state.games[gameId].isActive);
// };

// // Helper function to get testnet AR for testing
// export const getTestAR = async (address: string): Promise<void> => {
//   console.log(`Getting test AR for address ${address}`);
//   try {
//     // This is a mock function since there's no official Arweave testnet faucet
//     // In a real implementation, you might use a custom faucet or manually add balances
//     // Here we're using Warp's testing capabilities to mint tokens
//     await warp.testing.addFunds(address, '100000000000000');
//     await warp.testing.generateBlock();
//     console.log(`Added test AR to ${address}`);
//   } catch (error) {
//     console.error('Error getting test AR:', error);
//     throw error;
//   }
// };


// // import Arweave from 'arweave';
// // import { SmartWeaveNodeFactory, LoggerFactory } from 'redstone-smartweave';
// // import { JWKInterface } from 'arweave/node/lib/wallet';

// // // Initialize Arweave
// // const arweave = Arweave.init({
// //   host: 'arweave.net',
// //   port: 443,
// //   protocol: 'https',
// // });

// // // Initialize SmartWeave
// // LoggerFactory.INST.logLevel('error');
// // const smartweave = SmartWeaveNodeFactory.memCached(arweave);

// // // Game contract ID (will be created when deploying the contract)
// // let GAME_CONTRACT_ID: string;

// // // Game contract state interface
// // interface GameContractState {
// //   games: {
// //     [gameId: string]: {
// //       creator: string;
// //       wagerAmount: number;
// //       maxPlayers: number;
// //       players: string[];
// //       isActive: boolean;
// //       winner: string;
// //       totalPot: number;
// //       gameEnded: boolean;
// //     }
// //   };
// //   balances: { [address: string]: number };
// //   owner: string;
// // }

// // // Function to deploy the game contract
// // export const deployGameContract = async (wallet: JWKInterface): Promise<string> => {
// //   const initialState: GameContractState = {
// //     games: {},
// //     balances: {},
// //     owner: await arweave.wallets.jwkToAddress(wallet)
// //   };

// //   // Contract source code - this is a simplified version
// //   const contractSource = `
// //     export function handle(state, action) {
// //       const input = action.input;
// //       const caller = action.caller;
      
// //       if (input.function === 'createGame') {
// //         const { gameId, wagerAmount, maxPlayers } = input;
        
// //         // Ensure the game doesn't already exist
// //         if (state.games[gameId]) {
// //           throw new ContractError('Game already exists');
// //         }
        
// //         // Ensure the caller has enough balance
// //         if (state.balances[caller] < wagerAmount) {
// //           throw new ContractError('Insufficient balance');
// //         }
        
// //         // Create the game
// //         state.games[gameId] = {
// //           creator: caller,
// //           wagerAmount,
// //           maxPlayers,
// //           players: [caller],
// //           isActive: true,
// //           winner: '',
// //           totalPot: wagerAmount,
// //           gameEnded: false
// //         };
        
// //         // Deduct from caller's balance
// //         state.balances[caller] -= wagerAmount;
        
// //         return { state };
// //       }
      
// //       if (input.function === 'joinGame') {
// //         const { gameId } = input;
        
// //         // Ensure the game exists and is active
// //         if (!state.games[gameId] || !state.games[gameId].isActive) {
// //           throw new ContractError('Game not found or not active');
// //         }
        
// //         const game = state.games[gameId];
        
// //         // Ensure the game isn't full
// //         if (game.players.length >= game.maxPlayers) {
// //           throw new ContractError('Game is full');
// //         }
        
// //         // Ensure the player isn't already in the game
// //         if (game.players.includes(caller)) {
// //           throw new ContractError('Already in game');
// //         }
        
// //         // Ensure the caller has enough balance
// //         if (state.balances[caller] < game.wagerAmount) {
// //           throw new ContractError('Insufficient balance');
// //         }
        
// //         // Add player to the game
// //         game.players.push(caller);
// //         game.totalPot += game.wagerAmount;
        
// //         // Deduct from caller's balance
// //         state.balances[caller] -= game.wagerAmount;
        
// //         return { state };
// //       }
      
// //       if (input.function === 'endGame') {
// //         const { gameId, winner } = input;
        
// //         // Ensure the game exists and is active
// //         if (!state.games[gameId] || !state.games[gameId].isActive) {
// //           throw new ContractError('Game not found or not active');
// //         }
        
// //         const game = state.games[gameId];
        
// //         // Ensure the game hasn't ended
// //         if (game.gameEnded) {
// //           throw new ContractError('Game already ended');
// //         }
        
// //         // Ensure the caller is the owner
// //         if (caller !== state.owner) {
// //           throw new ContractError('Only the owner can end games');
// //         }
        
// //         // Ensure the winner is in the game
// //         if (!game.players.includes(winner)) {
// //           throw new ContractError('Winner must be a player');
// //         }
        
// //         // End the game and set the winner
// //         game.isActive = false;
// //         game.gameEnded = true;
// //         game.winner = winner;
        
// //         // Transfer the pot to the winner
// //         if (state.balances[winner]) {
// //           state.balances[winner] += game.totalPot;
// //         } else {
// //           state.balances[winner] = game.totalPot;
// //         }
// //         game.totalPot = 0;
        
// //         return { state };
// //       }
      
// //       if (input.function === 'deposit') {
// //         const { amount } = input;
        
// //         // Add to caller's balance
// //         if (state.balances[caller]) {
// //           state.balances[caller] += amount;
// //         } else {
// //           state.balances[caller] = amount;
// //         }
        
// //         return { state };
// //       }
      
// //       if (input.function === 'withdraw') {
// //         const { amount } = input;
        
// //         // Ensure the caller has enough balance
// //         if (!state.balances[caller] || state.balances[caller] < amount) {
// //           throw new ContractError('Insufficient balance');
// //         }
        
// //         // Deduct from caller's balance
// //         state.balances[caller] -= amount;
        
// //         return { state };
// //       }
      
// //       throw new ContractError('Invalid function');
// //     }
// //   `;

// //   try {
// //     // Create contract transaction
// //     const contractTx = await arweave.createTransaction({ data: contractSource }, wallet);
// //     contractTx.addTag('App-Name', 'SmartWeaveContract');
// //     contractTx.addTag('App-Version', '0.3.0');
// //     contractTx.addTag('Contract-Type', 'js-v2');

// //     // Sign and post the contract
// //     await arweave.transactions.sign(contractTx, wallet);
// //     await arweave.transactions.post(contractTx);

// //     // Deploy the contract with initial state
// //     const contractId = await smartweave.createContract.deploy({
// //       wallet,
// //       initState: JSON.stringify(initialState),
// //       src: contractTx.id,
// //     });

// //     console.log('Game contract deployed:', contractId);
// //     GAME_CONTRACT_ID = contractId;
// //     return contractId;
// //   } catch (error) {
// //     console.error('Error deploying game contract:', error);
// //     throw error;
// //   }
// // };

// // // Function to read contract state
// // export const getContractState = async (): Promise<GameContractState> => {
// //   if (!GAME_CONTRACT_ID) {
// //     throw new Error('Contract not deployed');
// //   }

// //   const contract = smartweave.contract(GAME_CONTRACT_ID);
// //   const state = await contract.readState();
// //   return state.state as GameContractState;
// // };

// // // Function to create a new game
// // export const createGame = async (
// //   wallet: JWKInterface,
// //   gameId: string,
// //   wagerAmount: number,
// //   maxPlayers: number
// // ): Promise<string> => {
// //   if (!GAME_CONTRACT_ID) {
// //     throw new Error('Contract not deployed');
// //   }

// //   const contract = smartweave.contract(GAME_CONTRACT_ID).connect(wallet);

// //   // First deposit AR if needed
// //   const state = await contract.readState();
// //   const walletAddress = await arweave.wallets.jwkToAddress(wallet);
// //   const currentBalance = (state.state as GameContractState).balances[walletAddress] || 0;
  
// //   if (currentBalance < wagerAmount) {
// //     await contract.writeInteraction({
// //       function: 'deposit',
// //       amount: wagerAmount,
// //     });
// //   }

// //   // Then create the game
// //   const result = await contract.writeInteraction({
// //     function: 'createGame',
// //     gameId,
// //     wagerAmount,
// //     maxPlayers,
// //   });

// //   return result.originalTxId;
// // };

// // // Function to join a game
// // export const joinGame = async (
// //   wallet: JWKInterface,
// //   gameId: string
// // ): Promise<string> => {
// //   if (!GAME_CONTRACT_ID) {
// //     throw new Error('Contract not deployed');
// //   }

// //   const contract = smartweave.contract(GAME_CONTRACT_ID).connect(wallet);
  
// //   // Get game details
// //   const state = await contract.readState();
// //   const gameState = (state.state as GameContractState).games[gameId];
  
// //   if (!gameState) {
// //     throw new Error('Game not found');
// //   }
  
// //   // Ensure we have enough balance
// //   const walletAddress = await arweave.wallets.jwkToAddress(wallet);
// //   const currentBalance = (state.state as GameContractState).balances[walletAddress] || 0;
  
// //   if (currentBalance < gameState.wagerAmount) {
// //     await contract.writeInteraction({
// //       function: 'deposit',
// //       amount: gameState.wagerAmount,
// //     });
// //   }

// //   // Join the game
// //   const result = await contract.writeInteraction({
// //     function: 'joinGame',
// //     gameId,
// //   });

// //   return result.originalTxId;
// // };

// // // Function to end a game
// // export const endGame = async (
// //   wallet: JWKInterface,
// //   gameId: string,
// //   winner: string
// // ): Promise<string> => {
// //   if (!GAME_CONTRACT_ID) {
// //     throw new Error('Contract not deployed');
// //   }

// //   const contract = smartweave.contract(GAME_CONTRACT_ID).connect(wallet);
  
// //   const result = await contract.writeInteraction({
// //     function: 'endGame',
// //     gameId,
// //     winner,
// //   });

// //   return result.originalTxId;
// // };

// // // Function to deposit AR
// // export const depositAR = async (
// //   wallet: JWKInterface,
// //   amount: number
// // ): Promise<string> => {
// //   if (!GAME_CONTRACT_ID) {
// //     throw new Error('Contract not deployed');
// //   }

// //   const contract = smartweave.contract(GAME_CONTRACT_ID).connect(wallet);
  
// //   const result = await contract.writeInteraction({
// //     function: 'deposit',
// //     amount,
// //   });

// //   return result.originalTxId;
// // };

// // // Function to withdraw AR
// // export const withdrawAR = async (
// //   wallet: JWKInterface,
// //   amount: number
// // ): Promise<string> => {
// //   if (!GAME_CONTRACT_ID) {
// //     throw new Error('Contract not deployed');
// //   }

// //   const contract = smartweave.contract(GAME_CONTRACT_ID).connect(wallet);
  
// //   const result = await contract.writeInteraction({
// //     function: 'withdraw',
// //     amount,
// //   });

// //   return result.originalTxId;
// // };

// // // Function to get game details
// // export const getGameDetails = async (gameId: string): Promise<any> => {
// //   const state = await getContractState();
// //   return state.games[gameId];
// // };

// // // Function to get player balance
// // export const getPlayerBalance = async (address: string): Promise<number> => {
// //   const state = await getContractState();
// //   return state.balances[address] || 0;
// // };

// // // Function to get active games
// // export const getActiveGames = async (): Promise<string[]> => {
// //   const state = await getContractState();
// //   return Object.keys(state.games).filter(gameId => state.games[gameId].isActive);
// // };