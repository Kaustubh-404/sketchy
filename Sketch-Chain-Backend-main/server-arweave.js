const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Arweave = require('arweave');
const { WarpFactory, LoggerFactory } = require('warp-contracts');
require('dotenv').config();

// Initialize Arweave for testnet
const arweave = Arweave.init({
  host: 'testnet.redstone.tools', // Arweave testnet node
  port: 443,
  protocol: 'https',
});

// Initialize Warp for testnet
LoggerFactory.INST.logLevel('error');
const warp = WarpFactory.forTestnet();

// Game manager wallet initialization
let gameManagerWallet;
let gameContract;

// Contract ID - should be loaded from environment or config
// This is the deployed SmartWeave contract ID
const GAME_CONTRACT_ID = process.env.GAME_CONTRACT_ID;

// Initialize Arweave connection
function initializeArweave() {
  try {
    // Use environment variables for key
    const GAME_MANAGER_KEY = process.env.GAME_MANAGER_KEY;

    if (!GAME_MANAGER_KEY || !GAME_CONTRACT_ID) {
      console.error('Missing Arweave configuration in environment variables');
      return false;
    }

    console.log('Initializing Arweave testnet connection with:');
    console.log('- Contract ID:', GAME_CONTRACT_ID);
    
    try {
      // Parse the wallet key from env
      gameManagerWallet = JSON.parse(GAME_MANAGER_KEY);
      
      // Connect to the contract - using Warp syntax for testnet
      gameContract = warp.contract(GAME_CONTRACT_ID).connect(gameManagerWallet);
      
      console.log('Successfully connected to Arweave testnet contract');
      return true;
    } catch (error) {
      console.error('Error initializing Arweave testnet connection:', error);
      return false;
    }
  } catch (error) {
    console.error('Failed to initialize Arweave testnet connection:', error);
    return false;
  }
}

const app = express();

// Basic route for checking if server is running
app.get('/', (req, res) => {
  res.send('Socket.io game server is running (Arweave Testnet Edition)');
});

// API endpoint to check room status in the contract
app.get('/api/room/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    if (!gameContract) {
      return res.status(500).json({ error: 'Contract not initialized' });
    }
    
    try {
      // Read contract state - using Warp syntax
      const state = await gameContract.readState();
      const gameState = state.cachedValue.state.games[roomCode];
      
      if (!gameState) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      res.json({
        roomCreator: gameState.creator,
        wagerAmount: gameState.wagerAmount,
        maxPlayers: gameState.maxPlayers,
        currentPlayerCount: gameState.players.length,
        isActive: gameState.isActive,
        winner: gameState.winner,
        totalPot: gameState.totalPot,
        gameEnded: gameState.gameEnded
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
app.get('/api/contract-info', async (req, res) => {
  try {
    if (!gameContract) {
      return res.status(500).json({ error: 'Contract not initialized' });
    }
    
    const state = await gameContract.readState();
    
    res.json({
      contractId: GAME_CONTRACT_ID,
      owner: state.cachedValue.state.owner,
      serverWalletAddress: await arweave.wallets.jwkToAddress(gameManagerWallet),
      isServerOwner: state.cachedValue.state.owner === await arweave.wallets.jwkToAddress(gameManagerWallet)
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ['GET', 'POST'],
  credentials: true
}));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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

// Function to store game data to Arweave
const storeGameData = async (gameCode, dataType, data) => {
  try {
    // Create tags for the data
    const tags = [
      { name: 'App-Name', value: 'Sketchy' },
      { name: 'Game-ID', value: gameCode },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Data-Type', value: dataType },
      { name: 'Timestamp', value: Date.now().toString() }
    ];
    
    // Create a data transaction
    const tx = await arweave.createTransaction({
      data: JSON.stringify(data)
    }, gameManagerWallet);
    
    // Add tags
    tags.forEach(tag => tx.addTag(tag.name, tag.value));
    
    // Sign the transaction
    await arweave.transactions.sign(tx, gameManagerWallet);
    
    // Post the transaction
    const response = await arweave.transactions.post(tx);
    
    console.log(`Stored ${dataType} data on Arweave testnet:`, tx.id);
    return tx.id;
  } catch (error) {
    console.error(`Error storing ${dataType} on Arweave testnet:`, error);
    return null;
  }
};

// Helper function to check Arweave transaction status
const checkArweaveTxStatus = async (txId) => {
  try {
    // Using testnet endpoint
    const response = await fetch(`https://testnet.redstone.tools/tx/${txId}/status`);
    
    if (response.status === 200) {
      const data = await response.json();
      return {
        status: data.status,
        confirmed: data.confirmed,
        confirmations: data.confirmed ? data.confirmed.number_of_confirmations : 0
      };
    } else if (response.status === 202) {
      return { status: 202, confirmed: false, confirmations: 0 };
    } else {
      return { status: response.status, confirmed: false, confirmations: 0 };
    }
  } catch (error) {
    console.error('Error checking Arweave transaction status:', error);
    return { status: 0, confirmed: false, confirmations: 0 };
  }
};

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

async function endRound(gameCode) {
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

  // Store the round data on Arweave
  const roundData = {
    gameCode,
    round: gameState.playersWhoDrawn.length,
    word: gameState.currentWord,
    drawer: gameState.currentDrawer,
    scores: gameState.points,
    correctGuessers: gameState.correctGuessers,
    drawingData: drawings.get(gameCode) || [],
    timestamp: Date.now()
  };
  
  // Store round data asynchronously
  storeGameData(gameCode, 'round-data', roundData);
  
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
      totalPrize = gameState.wagerAmount;
    } else if (typeof gameState.wagerAmount === 'number') {
      totalPrize = gameState.wagerAmount;
    } else {
      // Default fallback
      totalPrize = 0;
      console.error('Unknown wager amount type:', gameState.wagerAmount);
    }
  } catch (error) {
    console.error('Error calculating total prize:', error);
    totalPrize = 0;
  }

  console.log('Calculated prize:', totalPrize.toString());

  // Call Warp contract to distribute prize
  if (gameContract && winnerAddress) {
    try {
      // Store final game result on Arweave
      const gameResultData = {
        gameCode,
        winner: winnerAddress,
        players: gameState.players,
        scores: gameState.points,
        totalPrize,
        timestamp: Date.now()
      };
      
      // Store game result
      const gameResultTxId = await storeGameData(gameCode, 'game-result', gameResultData);
      
      // Store chat history
      const chatHistoryTxId = await storeGameData(
        gameCode, 
        'chat-history', 
        { messages: gameState.chatMessages || [] }
      );
      
      console.log('Game result stored on Arweave testnet:', gameResultTxId);
      console.log('Chat history stored on Arweave testnet:', chatHistoryTxId);
      
      // Call contract to distribute prize - updated for Warp
      const result = await gameContract.writeInteraction({
        function: 'endGame',
        gameId: gameCode,
        winner: winnerAddress
      });
      
      console.log('End game transaction submitted:', result.originalTxId);
      
      // Wait for confirmation (but don't block)
      setTimeout(async () => {
        try {
          const status = await checkArweaveTxStatus(result.originalTxId);
          if (status.confirmed) {
            io.to(gameCode).emit('transactionConfirmed', {
              winner: winnerAddress,
              transactionHash: result.originalTxId,
              gameCode: gameCode
            });
            console.log('End game transaction confirmed!');
          } else {
            console.log('End game transaction pending:', status);
          }
        } catch (error) {
          console.error('Error checking transaction status:', error);
        }
      }, 30000); // Check after 30 seconds
      
      // Emit transaction submitted event immediately
      io.to(gameCode).emit('transactionSubmitted', {
        winner: winnerAddress,
        transactionHash: result.originalTxId,
        gameCode: gameCode
      });
      
    } catch (error) {
      console.error('Error calling endGame on Warp contract:', error);
      
      io.to(gameCode).emit('transactionFailed', {
        error: error.message || 'Failed to transfer prize',
        gameCode: gameCode
      });
    }
  } else {
    console.error('Contract not initialized or no winner found:', { 
      contractInitialized: !!gameContract, 
      winnerAddress 
    });
    io.to(gameCode).emit('transactionSkipped', {
      reason: !gameContract ? 'Contract not initialized' : 
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
      wagerAmount: 0,
      chatMessages: []
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

    // Add message to chat history
    const guessMessage = {
      player: address,
      text: guess,
      type: 'guess',
      timestamp: Date.now()
    };
    
    gameState.chatMessages = [...(gameState.chatMessages || []), guessMessage];
    games.set(gameCode, gameState);

    // Emit the guess to all players for chat
    io.to(gameCode).emit('chatMessage', guessMessage);

    if (guess.toLowerCase() === gameState.currentWord.toLowerCase()) {
      // Calculate points based on time remaining
      const points = Math.ceil((gameState.timeLeft / 90) * 100);
      gameState.points[address] = (gameState.points[address] || 0) + points;
      gameState.correctGuessers.push(address);
      
      // Add correct guess message to chat
      const correctMessage = {
        player: 'system',
        text: `${name || address.slice(0, 6)} guessed correctly!`,
        type: 'system',
        timestamp: Date.now()
      };
      
      gameState.chatMessages = [...gameState.chatMessages, correctMessage];
      games.set(gameCode, gameState);
      
      io.to(gameCode).emit('correctGuess', {
        player: address,
        points: gameState.points[address]
      });
      
      io.to(gameCode).emit('chatMessage', correctMessage);

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
    const gameState = games.get(gameCode);
    if (!gameState) return;
    
    const chatMessage = {
      player: address,
      text: message,
      type: 'chat',
      timestamp: Date.now()
    };
    
    // Add to game state for permanent storage
    gameState.chatMessages = [...(gameState.chatMessages || []), chatMessage];
    games.set(gameCode, gameState);
    
    io.to(gameCode).emit('chatMessage', chatMessage);
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

// Initialize Arweave connection when server starts
const arweaveInitialized = initializeArweave();
console.log('Arweave testnet initialization status:', arweaveInitialized);

// Periodically check contract state and game activity
setInterval(async () => {
  try {
    if (!gameContract) return;
    
    const state = await gameContract.readState();
    const activeGames = Object.keys(state.cachedValue.state.games).filter(
      gameId => state.cachedValue.state.games[gameId].isActive
    );
    
    console.log('Active games in contract:', activeGames.length);
  } catch (error) {
    console.error('Error checking contract state:', error);
  }
}, 300000); // Check every 5 minutes

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));