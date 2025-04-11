// backend/server.js
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const ethers = require('ethers');
require('dotenv').config();

// Set up the provider and signer for the game manager
let provider;
let gameManagerWallet;
let scribbleContract;

// Initialize blockchain connection
function initializeBlockchain() {
  try {
    // Use environment variables for your RPC URL and private key
    const RPC_URL = process.env.RPC_URL;
    const GAME_MANAGER_PRIVATE_KEY = process.env.GAME_MANAGER_PRIVATE_KEY;
    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

    if (!RPC_URL || !GAME_MANAGER_PRIVATE_KEY || !CONTRACT_ADDRESS) {
      console.error('Missing blockchain configuration in environment variables');
      return false;
    }

    console.log('Initializing blockchain connection with:');
    console.log('- RPC URL:', RPC_URL);
    console.log('- Contract Address:', CONTRACT_ADDRESS);
    
    // Check if private key has 0x prefix and remove it if needed
    const cleanPrivateKey = GAME_MANAGER_PRIVATE_KEY.startsWith('0x') 
      ? GAME_MANAGER_PRIVATE_KEY.substring(2) 
      : GAME_MANAGER_PRIVATE_KEY;
    
    // Fix for ethers v6 (if you're using v6)
    try {
      // Try ethers v6 syntax first
      provider = new ethers.JsonRpcProvider(RPC_URL);
      gameManagerWallet = new ethers.Wallet(cleanPrivateKey, provider);
      console.log('Using ethers v6 syntax');
    } catch (e) {
      // Fallback to ethers v5 syntax
      console.log("Falling back to ethers v5 syntax");
      provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      gameManagerWallet = new ethers.Wallet(cleanPrivateKey, provider);
    }

    // Log wallet info
    console.log('Wallet address:', gameManagerWallet.address);
    
    // Prepare a complete ABI that includes the functions we need
    const completeABI = [
      // endGame function
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "roomCode",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "winner",
            "type": "address"
          }
        ],
        "name": "endGame",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      // gameManager function
      {
        "inputs": [],
        "name": "gameManager",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      // owner function
      {
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      // getRoomDetails function
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "roomCode",
            "type": "string"
          }
        ],
        "name": "getRoomDetails",
        "outputs": [
          {
            "internalType": "address",
            "name": "roomCreator",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "wagerAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "maxPlayers",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "currentPlayerCount",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isActive",
            "type": "bool"
          },
          {
            "internalType": "address",
            "name": "winner",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "totalPot",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "gameEnded",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      // getRoomPlayers function
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "roomCode",
            "type": "string"
          }
        ],
        "name": "getRoomPlayers",
        "outputs": [
          {
            "internalType": "address[]",
            "name": "",
            "type": "address[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ];

    scribbleContract = new ethers.Contract(CONTRACT_ADDRESS, completeABI, gameManagerWallet);
    
    // Verify contract connection by calling a view function
    Promise.all([
      scribbleContract.gameManager(),
      scribbleContract.owner(),
      provider.getBalance(CONTRACT_ADDRESS)
    ]).then(([gameManager, owner, contractBalance]) => {
      console.log('Successfully connected to contract:');
      console.log('- Game Manager:', gameManager);
      console.log('- Contract Owner:', owner);
      console.log('- Contract Balance:', ethers.utils ? 
        ethers.utils.formatEther(contractBalance) : 
        ethers.formatEther(contractBalance));
      
      // Check if our wallet is authorized
      const isAuthorized = (
        gameManager.toLowerCase() === gameManagerWallet.address.toLowerCase() || 
        owner.toLowerCase() === gameManagerWallet.address.toLowerCase()
      );
      
      console.log('- Server authorized to call endGame:', isAuthorized);
      
      if (!isAuthorized) {
        console.warn('WARNING: Server wallet is not authorized as gameManager or owner!');
        console.warn('Transactions to endGame will fail unless the contract owner adds this wallet as gameManager.');
        console.warn(`Current wallet: ${gameManagerWallet.address}`);
      }
    }).catch(error => {
      console.error('Error verifying contract connection:', error);
    });
    
    console.log('Blockchain connection initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize blockchain connection:', error);
    return false;
  }
}

const app = express();

// Basic route for checking if server is running
app.get('/', (req, res) => {
  res.send('Socket.io game server is running');
});

// API endpoint to check room status in the contract
app.get('/api/room/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    if (!scribbleContract) {
      return res.status(500).json({ error: 'Contract not initialized' });
    }
    
    try {
      const roomDetails = await scribbleContract.getRoomDetails(roomCode);
      
      res.json({
        roomCreator: roomDetails.roomCreator,
        wagerAmount: roomDetails.wagerAmount.toString(),
        maxPlayers: roomDetails.maxPlayers.toString(),
        currentPlayerCount: roomDetails.currentPlayerCount.toString(),
        isActive: roomDetails.isActive,
        winner: roomDetails.winner,
        totalPot: roomDetails.totalPot.toString(),
        gameEnded: roomDetails.gameEnded
      });
    } catch (error) {
      res.status(404).json({ error: 'Room not found or error fetching details', message: error.message });
    }
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to check the contract's game manager
app.get('/api/game-manager', async (req, res) => {
  try {
    if (!scribbleContract) {
      return res.status(500).json({ error: 'Contract not initialized' });
    }
    
    const gameManager = await scribbleContract.gameManager();
    const owner = await scribbleContract.owner();
    const serverWalletAddress = gameManagerWallet.address;
    
    res.json({
      contractGameManager: gameManager,
      contractOwner: owner,
      serverWalletAddress: serverWalletAddress,
      isServerGameManager: gameManager.toLowerCase() === serverWalletAddress.toLowerCase(),
      isServerOwner: owner.toLowerCase() === serverWalletAddress.toLowerCase()
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to check balances
app.get('/api/balances', async (req, res) => {
  try {
    if (!provider || !scribbleContract) {
      return res.status(500).json({ error: 'Blockchain not initialized' });
    }
    
    // Get contract balance
    const contractBalance = await provider.getBalance(scribbleContract.address);
    
    // Get server wallet balance
    const serverBalance = await gameManagerWallet.getBalance();
    
    res.json({
      contractBalance: contractBalance.toString(),
      serverWalletBalance: serverBalance.toString(),
      contractBalanceEth: ethers.utils ? 
        ethers.utils.formatEther(contractBalance) : 
        ethers.formatEther(contractBalance),
      serverWalletBalanceEth: ethers.utils ? 
        ethers.utils.formatEther(serverBalance) : 
        ethers.formatEther(serverBalance)
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use(cors({
  origin: ["https://sketchy-tcore-frontend.vercel.app"],
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ['GET', 'POST'],
  credentials: true
}));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["https://sketchy-tcore-frontend.vercel.app"],
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Word categories
const WORD_CATEGORIES = {
  animals: ['dog', 'cat', 'elephant', 'giraffe', 'lion', 'tiger', 'penguin', 'zebra', 'monkey', 'koala'],
  objects: ['chair', 'table', 'lamp', 'phone', 'computer', 'book', 'pencil', 'clock', 'glasses', 'umbrella'],
  food: ['pizza', 'burger', 'sushi', 'pasta', 'sandwich', 'taco', 'cookie', 'ice cream', 'cake', 'apple'],
  places: ['beach', 'mountain', 'park', 'library', 'school', 'hospital', 'airport', 'restaurant', 'museum', 'cinema'],
  activities: ['swimming', 'running', 'dancing', 'singing', 'reading', 'writing', 'cooking', 'painting', 'sleeping', 'playing']
};

const games = new Map();
const drawings = new Map();
const timers = new Map();

function getRandomWord() {
  const categories = Object.keys(WORD_CATEGORIES);
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const words = WORD_CATEGORIES[randomCategory];
  return words[Math.floor(Math.random() * words.length)];
}

function checkGameEnd(gameCode) {
  const gameState = games.get(gameCode);
  if (!gameState) return false;

  // Check if we've completed all rounds (3 rounds by default)
  const totalRounds = 3;
  
  // Count unique players who have drawn
  const uniqueDrawers = new Set(gameState.playersWhoDrawn);
  
  // End game if we've had enough unique drawers (each player has drawn once)
  if (uniqueDrawers.size >= Math.min(gameState.players.length, totalRounds)) {
    endGame(gameCode);
    return true;
  }
  return false;
}

function startNewRound(gameCode) {
  const gameState = games.get(gameCode);
  if (!gameState || !gameState.isGameStarted) return;

  // Clear existing timer
  if (timers.has(gameCode)) {
    clearInterval(timers.get(gameCode));
  }

  gameState.currentWord = getRandomWord();
  gameState.timeLeft = 90;
  gameState.roundActive = true;
  gameState.correctGuessers = [];
  games.set(gameCode, gameState);

  drawings.set(gameCode, []);

  io.to(gameCode).emit('roundStart', {
    drawer: gameState.currentDrawer,
    word: gameState.currentWord,
    timeLeft: gameState.timeLeft
  });

  const timer = setInterval(() => {
    const currentState = games.get(gameCode);
    if (!currentState || !currentState.roundActive) {
      clearInterval(timer);
      timers.delete(gameCode);
      return;
    }

    currentState.timeLeft--;
    games.set(gameCode, currentState);
    io.to(gameCode).emit('timeUpdate', currentState.timeLeft);

    if (currentState.timeLeft <= 0) {
      clearInterval(timer);
      timers.delete(gameCode);
      endRound(gameCode);
    }
  }, 1000);

  timers.set(gameCode, timer);
}

function endRound(gameCode) {
  const gameState = games.get(gameCode);
  if (!gameState) return;

  if (timers.has(gameCode)) {
    clearInterval(timers.get(gameCode));
    timers.delete(gameCode);
  }

  gameState.roundActive = false;
  gameState.playersWhoDrawn.push(gameState.currentDrawer);
  
  // Find next drawer who hasn't drawn yet (if possible)
  let nextDrawerIndex = -1;
  const currentDrawerIndex = gameState.players.findIndex(p => p.address === gameState.currentDrawer);
  
  // First try to find someone who hasn't drawn yet
  for (let i = 1; i <= gameState.players.length; i++) {
    const index = (currentDrawerIndex + i) % gameState.players.length;
    const potentialDrawer = gameState.players[index].address;
    
    // If this player hasn't drawn yet, choose them
    if (!gameState.playersWhoDrawn.includes(potentialDrawer)) {
      nextDrawerIndex = index;
      break;
    }
  }
  
  // If everyone has drawn at least once, just pick the next player
  if (nextDrawerIndex === -1) {
    nextDrawerIndex = (currentDrawerIndex + 1) % gameState.players.length;
  }
  
  gameState.currentDrawer = gameState.players[nextDrawerIndex].address;
  games.set(gameCode, gameState);

  io.to(gameCode).emit('roundEnd', {
    scores: gameState.points,
    nextDrawer: gameState.currentDrawer,
    word: gameState.currentWord // Send the word that was being drawn
  });

  // Check if game should end
  if (!checkGameEnd(gameCode)) {
    setTimeout(() => {
      if (games.has(gameCode)) {
        startNewRound(gameCode);
      }
    }, 3000);
  }
}

async function endGame(gameCode) {
  const gameState = games.get(gameCode);
  if (!gameState) {
    console.error(`Cannot end game ${gameCode} - game state not found`);
    return;
  }

  // Find winner (highest score)
  let winnerAddress = '';
  let highestScore = -1;
  
  Object.entries(gameState.points).forEach(([address, points]) => {
    if (points > highestScore) {
      highestScore = points;
      winnerAddress = address;
    }
  });

  // If no winner was found (no points scored), set the first player as winner
  if (winnerAddress === '' && gameState.players.length > 0) {
    winnerAddress = gameState.players[0].address;
    console.log(`No points scored, setting first player as winner: ${winnerAddress}`);
  }

  // Debug wager amount
  console.log('Game ended with wager amount:', gameState.wagerAmount);
  console.log('Wager amount type:', typeof gameState.wagerAmount);
  console.log('Number of players:', gameState.players.length);

  // Calculate total prize
  let totalPrize;
  try {
    if (typeof gameState.wagerAmount === 'bigint') {
      totalPrize = gameState.wagerAmount * BigInt(gameState.players.length);
    } else if (typeof gameState.wagerAmount === 'string') {
      totalPrize = BigInt(gameState.wagerAmount) * BigInt(gameState.players.length);
    } else if (typeof gameState.wagerAmount === 'number') {
      totalPrize = BigInt(Math.floor(gameState.wagerAmount)) * BigInt(gameState.players.length);
    } else {
      // Default fallback
      totalPrize = BigInt(0);
      console.error('Unknown wager amount type:', gameState.wagerAmount);
    }
  } catch (error) {
    console.error('Error calculating total prize:', error);
    totalPrize = BigInt(0);
  }

  console.log('Calculated prize:', totalPrize.toString());

  // Call smart contract to distribute prize
  if (scribbleContract && winnerAddress) {
    try {
      // Check if we have permission to call endGame
      let isAuthorized = false;
      try {
        const gameManager = await scribbleContract.gameManager();
        const owner = await scribbleContract.owner();
        
        console.log('Contract game manager:', gameManager);
        console.log('Contract owner:', owner);
        console.log('Our wallet address:', gameManagerWallet.address);
        
        isAuthorized = (
          gameManager.toLowerCase() === gameManagerWallet.address.toLowerCase() || 
          owner.toLowerCase() === gameManagerWallet.address.toLowerCase()
        );
        
        console.log('Server is authorized to call endGame:', isAuthorized);
      } catch (error) {
        console.error('Error checking authorization:', error);
      }
      
      // Check room state in contract
      try {
        const roomDetails = await scribbleContract.getRoomDetails(gameCode);
        console.log('Room details from contract:');
        console.log('- Room creator:', roomDetails.roomCreator);
        console.log('- Wager amount:', roomDetails.wagerAmount.toString());
        console.log('- Total pot:', roomDetails.totalPot.toString());
        console.log('- Is active:', roomDetails.isActive);
        console.log('- Game ended:', roomDetails.gameEnded);
        
        // Check if game is already ended
        if (roomDetails.gameEnded) {
          console.log('Game already ended on the contract!');
          io.to(gameCode).emit('transactionSkipped', {
            reason: 'Game already ended on the contract',
            gameCode: gameCode
          });
          
          // Still notify of game end but don't try to end again
          io.to(gameCode).emit('gameEnd', {
            winner: winnerAddress,
            points: gameState.points,
            totalPrize: totalPrize.toString(),
          });
          
          // Clean up
          games.delete(gameCode);
          drawings.delete(gameCode);
          if (timers.has(gameCode)) {
            clearInterval(timers.get(gameCode));
            timers.delete(gameCode);
          }
          
          return;
        }
        
        // Check if room is active
        if (!roomDetails.isActive) {
          console.log('Room is not active on the contract!');
          io.to(gameCode).emit('transactionSkipped', {
            reason: 'Room is not active on the contract',
            gameCode: gameCode
          });
          
          // Still notify of game end
          io.to(gameCode).emit('gameEnd', {
            winner: winnerAddress,
            points: gameState.points,
            totalPrize: totalPrize.toString(),
          });
          
          // Clean up
          games.delete(gameCode);
          drawings.delete(gameCode);
          if (timers.has(gameCode)) {
            clearInterval(timers.get(gameCode));
            timers.delete(gameCode);
          }
          
          return;
        }
      } catch (error) {
        console.error('Error checking room details:', error);
      }
      
      // If we're not authorized, skip the transaction
      if (!isAuthorized) {
        console.log('Server is not authorized to call endGame!');
        io.to(gameCode).emit('transactionSkipped', {
          reason: 'Server not authorized to call endGame',
          gameCode: gameCode
        });
        
        // Still notify of game end
        io.to(gameCode).emit('gameEnd', {
          winner: winnerAddress,
          points: gameState.points,
          totalPrize: totalPrize.toString(),
        });
        
        // Clean up
        games.delete(gameCode);
        drawings.delete(gameCode);
        if (timers.has(gameCode)) {
          clearInterval(timers.get(gameCode));
          timers.delete(gameCode);
        }
        
        return;
      }
      
      console.log(`Ending game ${gameCode} with winner ${winnerAddress}`);
      console.log(`Prize amount: ${totalPrize.toString()}`);
      
      // Check players in the room
      try {
        const players = await scribbleContract.getRoomPlayers(gameCode);
        console.log('Players in room:', players);
        
        // Check if winner is in the players list
        const winnerInPlayers = players.find(player => 
          player.toLowerCase() === winnerAddress.toLowerCase()
        );
        
        console.log('Winner is in players list:', !!winnerInPlayers);
        
        if (!winnerInPlayers) {
          console.error('Winner is not in players list!');
          io.to(gameCode).emit('transactionSkipped', {
            reason: 'Winner is not in players list',
            gameCode: gameCode
          });
          
          // Use the room creator as winner instead
          const roomDetails = await scribbleContract.getRoomDetails(gameCode);
          winnerAddress = roomDetails.roomCreator;
          console.log('Using room creator as winner instead:', winnerAddress);
        }
      } catch (error) {
        console.error('Error checking players in room:', error);
      }
      
      // Get current gas price for better transaction success
      let gasPrice;
      try {
        gasPrice = await provider.getGasPrice();
        console.log('Current gas price:', gasPrice.toString());
      } catch (error) {
        console.error('Error getting gas price:', error);
      }
      
      // Send transaction with higher gas limit and price
      const txOptions = {
        gasLimit: 500000  // Increase gas limit
      };
      
      // Add gas price if available
      if (gasPrice) {
        // Use 20% higher gas price for faster confirmation
        // Handle ethers v5 vs v6 differences
        if (gasPrice.mul) {
          // ethers v5
          txOptions.gasPrice = gasPrice.mul(12).div(10);
        } else {
          // ethers v6
          txOptions.gasPrice = gasPrice * 1.2;
        }
      }
      
      console.log('Transaction options:', txOptions);
      
      const tx = await scribbleContract.endGame(gameCode, winnerAddress, txOptions);
      console.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      // Get transaction hash based on ethers version
      let txHash;
      if (receipt.transactionHash) {
        // ethers v5
        txHash = receipt.transactionHash;
      } else if (receipt.hash) {
        // ethers v6
        txHash = receipt.hash;
      } else {
        // Fallback if structure is different
        txHash = tx.hash;
      }
      
      console.log('Full receipt:', JSON.stringify(receipt, (key, value) => {
        if (typeof value === 'bigint') return value.toString();
        return value;
      }, 2));
      
      console.log(`Transaction confirmed: ${txHash}`);
      
      // Check if the transaction was successful
      if (receipt.status === 1 || receipt.status === true) {
        console.log('Transaction successful!');
        
        io.to(gameCode).emit('transactionConfirmed', {
          winner: winnerAddress,
          transactionHash: txHash,
          gameCode: gameCode
        });
      } else {
        console.error('Transaction failed!');
        
        io.to(gameCode).emit('transactionFailed', {
          error: 'Transaction completed but failed',
          gameCode: gameCode
        });
      }
    } catch (error) {
      console.error('Error calling endGame on smart contract:', error);
      
      // More detailed error logging
      if (error.reason) {
        console.error('Error reason:', error.reason);
      }
      
      if (error.code) {
        console.error('Error code:', error.code);
      }
      
      if (error.error && error.error.message) {
        console.error('Inner error message:', error.error.message);
      }
      
      io.to(gameCode).emit('transactionFailed', {
        error: error.reason || error.message || 'Failed to transfer prize',
        gameCode: gameCode
      });
    }
  } else {
    console.error('Contract not initialized or no winner found:', { 
      contractInitialized: !!scribbleContract, 
      winnerAddress 
    });
    io.to(gameCode).emit('transactionSkipped', {
      reason: !scribbleContract ? 'Contract not initialized' : 
              !winnerAddress ? 'No winner determined' : 
              'Prize amount is zero',
      gameCode: gameCode
    });
  }

  io.to(gameCode).emit('gameEnd', {
    winner: winnerAddress,
    points: gameState.points,
    totalPrize: totalPrize.toString(),
  });

  // Cleanup
  games.delete(gameCode);
  drawings.delete(gameCode);
  if (timers.has(gameCode)) {
    clearInterval(timers.get(gameCode));
    timers.delete(gameCode);
  }
}

io.on('connection', (socket) => {
  const { gameCode, address, name } = socket.handshake.query;
  
  console.log(`Socket connection attempt: Game=${gameCode}, Address=${address}`);
  
  if (!gameCode || !address) {
    console.log('Connection rejected: Missing gameCode or address');
    socket.disconnect();
    return;
  }

  socket.join(gameCode);
  console.log(`Player ${address} joined game ${gameCode}`);
  
  if (!games.has(gameCode)) {
    games.set(gameCode, {
      currentDrawer: address,
      currentWord: '',
      players: [{ address, name: name || `Player ${address.slice(0, 6)}` }],
      points: {},
      timeLeft: 90,
      isActive: true,
      isGameStarted: false,
      roundActive: false,
      playersWhoDrawn: [],
      correctGuessers: [],
      wagerAmount: 0
    });
  } else {
    const gameState = games.get(gameCode);
    if (!gameState.players.find(p => p.address === address)) {
      gameState.players.push({ address, name: name || `Player ${address.slice(0, 6)}` });
      games.set(gameCode, gameState);
    }
  }

  // Handle setting wager amount
  socket.on('setWagerAmount', (amount) => {
    console.log(`Received wager amount for game ${gameCode}:`, amount);
    
    const gameState = games.get(gameCode);
    if (!gameState) return;
    
    try {
      // Store as string since we'll convert it later
      if (amount && gameState.wagerAmount === 0) {
        console.log(`Setting wager amount for game ${gameCode} to ${amount}`);
        gameState.wagerAmount = amount;
        games.set(gameCode, gameState);
      }
    } catch (error) {
      console.error('Error setting wager amount:', error);
    }
  });

  const gameState = games.get(gameCode);
  io.to(gameCode).emit('gameState', gameState);

  socket.on('startGame', () => {
    const gameState = games.get(gameCode);
    if (!gameState || gameState.isGameStarted) return;

    if (gameState.players.length < 2) {
      socket.emit('error', { message: 'Not enough players' });
      return;
    }

    gameState.isGameStarted = true;
    gameState.isActive = true;
    games.set(gameCode, gameState);

    io.to(gameCode).emit('gameState', {
      ...gameState,
      isGameStarted: true
    });

    startNewRound(gameCode);
  });

  socket.on('guess', (guess) => {
    const gameState = games.get(gameCode);
    if (!gameState?.roundActive || gameState.currentDrawer === address) return;

    // Already guessed correctly
    if (gameState.correctGuessers.includes(address)) return;

    // Emit the guess to all players for chat
    io.to(gameCode).emit('chatMessage', {
      player: address,
      text: guess,
      type: 'guess'
    });

    if (guess.toLowerCase() === gameState.currentWord.toLowerCase()) {
      // Calculate points based on time remaining
      const points = Math.ceil((gameState.timeLeft / 90) * 100);
      gameState.points[address] = (gameState.points[address] || 0) + points;
      gameState.correctGuessers.push(address);
      
      io.to(gameCode).emit('correctGuess', {
        player: address,
        points: gameState.points[address]
      });

      // End round if all players have guessed correctly
      const nonDrawingPlayers = gameState.players.length - 1;
      if (gameState.correctGuessers.length >= nonDrawingPlayers) {
        endRound(gameCode);
      }
    } else {
      socket.emit('wrongGuess', { guess });
    }
  });

  socket.on('draw', (drawData) => {
    const gameState = games.get(gameCode);
    if (!gameState?.roundActive || gameState.currentDrawer !== address) return;
    
    // Store drawing data
    const currentDrawings = drawings.get(gameCode) || [];
    drawings.set(gameCode, [...currentDrawings, ...drawData.lines]);
    
    // Broadcast to other players
    socket.to(gameCode).emit('drawUpdate', drawData);
  });

  socket.on('chatMessage', (message) => {
    io.to(gameCode).emit('chatMessage', {
      player: address,
      text: message,
      type: 'chat'
    });
  });

  socket.on('disconnect', () => {
    console.log(`Player ${address} disconnected from game ${gameCode}`);
    
    const gameState = games.get(gameCode);
    if (!gameState) return;

    // Remove player from the game
    gameState.players = gameState.players.filter(p => p.address !== address);
    
    // If all players left, clean up the game
    if (gameState.players.length === 0) {
      console.log(`No players left in game ${gameCode}, cleaning up`);
      games.delete(gameCode);
      drawings.delete(gameCode);
      if (timers.has(gameCode)) {
        clearInterval(timers.get(gameCode));
        timers.delete(gameCode);
      }
    } else {
      // If the current drawer left, move to next player
      if (gameState.currentDrawer === address) {
        gameState.currentDrawer = gameState.players[0].address;
        if (gameState.roundActive) {
          endRound(gameCode);
        }
      }
      games.set(gameCode, gameState);
      io.to(gameCode).emit('gameState', gameState);
    }
  });
});

// Initialize blockchain connection when server starts
const blockchainInitialized = initializeBlockchain();
console.log('Blockchain initialization status:', blockchainInitialized);

// Check contract and wallet balances periodically
// setInterval(async () => {
//   try {
//     if (!provider || !scribbleContract || !gameManagerWallet) return;
    
//     const contractAddress = scribbleContract.address;
//     const contractBalance = await provider.getBalance(contractAddress);
//     const serverBalance = await gameManagerWallet.getBalance();
    
//     const formatEther = ethers.utils ? ethers.utils.formatEther : ethers.formatEther;
    
//     console.log('--- Contract Balance Check ---');
//     console.log(`Contract (${contractAddress}): ${formatEther(contractBalance)} ETH`);
//     console.log(`Server Wallet (${gameManagerWallet.address}): ${formatEther(serverBalance)} ETH`);
//   } catch (error) {
//     console.error('Error checking balances:', error);
//   }
// }, 300000); // Check every 5 minutes


setInterval(async () => {
  try {
    if (!provider || !scribbleContract || !gameManagerWallet) return;

    const contractAddress = scribbleContract.address;
    const walletAddress = gameManagerWallet.address;

    if (!contractAddress) {
      console.error('Error: Contract address is undefined or null.');
      return;
    }

    if (!walletAddress) {
      console.error('Error: Wallet address is undefined or null.');
      return;
    }

    const contractBalance = await provider.getBalance(contractAddress);
    const serverBalance = await provider.getBalance(walletAddress);

    const formatEther = ethers.utils ? ethers.utils.formatEther : ethers.formatEther;

    console.log('--- Contract Balance Check ---');
    console.log(`Contract (${contractAddress}): ${formatEther(contractBalance)} ETH`);
    console.log(`Server Wallet (${walletAddress}): ${formatEther(serverBalance)} ETH`);
  } catch (error) {
    console.error('Error checking balances:', error);
  }
}, 300000); // Check every 5 minutes


const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));