"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/router"
import { useAccount } from "wagmi"
import { toast } from "react-hot-toast"
import { io, type Socket } from "socket.io-client"
import { DrawingCanvas } from "./DrawingCanvasArweave"
import { Chat } from "./Chat"
import { LoadingOverlay } from "./LoadingOverlay"
import { ArweaveWalletFull } from "./ArweaveWalletFull"
import { useScribbleContract } from "@/hooks/useScribbleContract"
import { useGameStore } from "@/store/gameStore"
import { Clock, Users, Palette, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { storeGameState, storeGameResult, storeChatHistory } from "@/services/gameStorageService"

// Define props interface
interface GameRoomArweaveProps {
  gameCode: string;
  wallet: any;
}

export const GameRoomArweave = ({ gameCode, wallet }: GameRoomArweaveProps) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [arweaveWallet, setArweaveWallet] = useState<any>(wallet) // Initialize with passed wallet
  const [isSavingToArweave, setSavingToArweave] = useState(false)

  const isInitializedRef = useRef(false)

  const router = useRouter()
  const { address } = useAccount()
  const { startGame, recordWordDrawn, recordCorrectGuess, forceEndRound, getRoomDetails } = useScribbleContract()
  const gameStore = useGameStore()

  // Handle Arweave wallet connection
  const handleArweaveWalletConnect = (wallet: any) => {
    setArweaveWallet(wallet)
    console.log("Arweave wallet connected:", wallet ? "Yes" : "No")
  }

  // Memoize these functions to prevent unnecessary re-renders
  const handleStartGame = useCallback(async () => {
    if (!gameCode) return

    try {
      // First notify the socket server
      if (socket) {
        socket.emit("startGame")
      }

      // Then start the game on the blockchain
      await startGame(gameCode as string)
    } catch (error) {
      console.error("Error starting game:", error)
      toast.error("Failed to start game", { style: { zIndex: 9999 } })
    }
  }, [gameCode, socket, startGame])

  const handleLeaveGame = useCallback(async () => {
    try {
      gameStore.reset()
      await router.push("/")
    } catch (error) {
      console.error("Navigation error:", error)
      window.location.href = "/"
    }
  }, [gameStore, router])

  // Connect to socket server and setup event listeners
  useEffect(() => {
    // To prevent multiple initializations
    if (isInitializedRef.current) return
    isInitializedRef.current = true

    // Prevent useEffect from running without required data
    if (!gameCode || !address) {
      isInitializedRef.current = false
      return
    }

    let socketInstance: Socket | null = null
    let isComponentMounted = true

    const setupSocket = async () => {
      console.log("Setting up socket connection for game:", gameCode)

      const playerName = localStorage.getItem("playerName") || `Player ${address.slice(0, 6)}`

      // Verify that the environment variable is set
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
      if (!socketUrl) {
        console.error("Socket URL environment variable is not set")
        if (isComponentMounted) {
          setConnectionError("Socket server URL is not configured")
          setIsConnecting(false)
        }
        return
      }

      // Create socket instance with explicit URL for better debugging
      try {
        socketInstance = io(socketUrl, {
          query: {
            gameCode,
            address,
            name: playerName,
          },
          transports: ["websocket", "polling"],
          reconnectionAttempts: 3,
          timeout: 10000,
        })

        // Connect event handler
        socketInstance.on("connect", async () => {
          console.log("Socket connected successfully")
          if (isComponentMounted) {
            setIsConnecting(false)
            setConnectionError(null)
          }

          // Send wager amount to server
          try {
            if (getRoomDetails) {
              const details = await getRoomDetails(gameCode as string)
              if (details && details.wagerAmount) {
                console.log("Found wager amount:", details.wagerAmount.toString())
                socketInstance?.emit("setWagerAmount", details.wagerAmount.toString())
              }
            }
          } catch (error) {
            console.error("Error getting room details:", error)
          }
        })

        // Connection error handler
        socketInstance.on("connect_error", (error) => {
          console.error("Socket connection error:", error)
          if (isComponentMounted) {
            setConnectionError("Failed to connect to game server")
            setIsConnecting(false)
          }
          toast.error("Failed to connect to game server", { style: { zIndex: 9999 } })
        })

        // Game state handler
        socketInstance.on("gameState", (state) => {
          if (!isComponentMounted) return

          console.log("Received game state:", state)
          gameStore.setCurrentDrawer(state.currentDrawer)
          gameStore.setCurrentWord(state.currentWord)
          gameStore.setTimeLeft(state.timeLeft)
          gameStore.setPlayers(state.players)
          gameStore.setIsDrawing(state.currentDrawer === address)
          gameStore.setIsGameStarted(state.isGameStarted)
          gameStore.setRoundActive(state.roundActive)

          if (state.players.length > 0) {
            // In the new contract, the room creator is the owner
            gameStore.setIsOwner(state.players[0].address === address)
          }
        })

        // Time update handler
        socketInstance.on("timeUpdate", (time) => {
          if (isComponentMounted) {
            gameStore.setTimeLeft(time)
          }
        })

        // Round start handler
        socketInstance.on("roundStart", ({ drawer, word, timeLeft }) => {
          if (!isComponentMounted) return

          gameStore.setCurrentDrawer(drawer)
          gameStore.setRoundActive(true)
          gameStore.setTimeLeft(timeLeft)
          gameStore.setIsDrawing(drawer === address)

          if (drawer === address) {
            gameStore.setCurrentWord(word)
            toast.success("Your turn to draw!", { style: { zIndex: 9999 } })

            // Record the word being drawn on the blockchain
            try {
              recordWordDrawn(gameCode as string, word)
            } catch (error) {
              console.error("Error recording word:", error)
            }
          } else {
            gameStore.setCurrentWord("")
            toast.success("Time to guess!", { style: { zIndex: 9999 } })
          }
          gameStore.clearCorrectGuessers()
        })

        // Round end handler
        socketInstance.on("roundEnd", ({ scores, nextDrawer, word }) => {
          if (!isComponentMounted) return

          gameStore.setRoundActive(false)
          gameStore.setCurrentDrawer(nextDrawer)
          gameStore.setCurrentWord("")
          gameStore.setIsDrawing(nextDrawer === address)

          // Update points in the store
          Object.entries(scores).forEach(([player, points]) => {
            gameStore.updatePoints(player, points as number)
          })

          toast("Round ended! The word was: " + word, {
            icon: "🔄",
            style: {
              background: "#3b82f6",
              color: "#ffffff",
              zIndex: 9999,
            },
            duration: 3000,
          })

          // If we're the room creator, we might need to force end the round
          if (gameStore.isOwner && gameStore.timeLeft <= 0) {
            try {
              forceEndRound(gameCode as string)
            } catch (error) {
              console.error("Error forcing round end:", error)
            }
          }

          // If we have an Arweave wallet, store the round state
          if (arweaveWallet && gameStore.isOwner) {
            storeRoundDataToArweave(word)
          }
        })

        // Wrong guess handler
        socketInstance.on("wrongGuess", ({ guess }) => {
          toast.error(`Wrong guess: ${guess}`, { duration: 2000, style: { zIndex: 9999 } })
        })

        // Correct guess handler
        socketInstance.on("correctGuess", ({ player, points }) => {
          if (!isComponentMounted) return

          gameStore.updatePoints(player, points)
          gameStore.addCorrectGuesser(player)

          toast.success(`${player === address ? "You" : "Someone"} guessed correctly!`, {
            duration: 3000,
            style: { zIndex: 9999 },
          })

          // If we're the room owner, record the correct guess on the blockchain
          if (gameStore.isOwner) {
            try {
              recordCorrectGuess(gameCode as string, player, gameStore.timeLeft)
            } catch (error) {
              console.error("Error recording correct guess:", error)
            }
          }
        })

        // Chat message handler
        socketInstance.on("chatMessage", (message) => {
          if (isComponentMounted) {
            gameStore.addChatMessage(message)
          }
        })

        // Game end handler
        socketInstance.on("gameEnd", async ({ winner, points, totalPrize }) => {
          if (!isComponentMounted) return

          console.log("Game ended! Winner:", winner)
          console.log("Prize amount:", totalPrize)

          const isWinner = winner === address

          // Store game results to Arweave if we have a wallet and we're the winner or the owner
          if (arweaveWallet && (isWinner || gameStore.isOwner)) {
            await storeGameDataToArweave(winner, points, totalPrize)
          }

          // Create a modal to show the winner and prize
          // (This part can remain similar to your original implementation)
          toast.success(`Game over! Winner: ${winner.substring(0, 6)}...`, {
            duration: 5000,
            style: { zIndex: 9999 },
          })

          // Navigate to the home page after a delay
          setTimeout(() => {
            router.push("/")
          }, 5000)
        })

        // Transaction events can remain similar to your original implementation

        // Save socket instance
        if (isComponentMounted) {
          setSocket(socketInstance)
        }
      } catch (error) {
        console.error("Error creating socket connection:", error)
        if (isComponentMounted) {
          setConnectionError("Failed to initialize connection to game server")
          setIsConnecting(false)
        }
      }
    }

    setupSocket()

    // Cleanup function
    return () => {
      console.log("Cleaning up socket connection")
      isComponentMounted = false
      isInitializedRef.current = false

      if (socketInstance) {
        socketInstance.disconnect()
      }
    }
  }, [gameCode, address, getRoomDetails, recordWordDrawn, recordCorrectGuess, forceEndRound, gameStore, router, arweaveWallet])

  // Function to store round data to Arweave
  const storeRoundDataToArweave = async (word: string) => {
    if (!arweaveWallet || !gameCode) return

    try {
      setSavingToArweave(true)
      
      // Get current round data
      const roundData = {
        gameCode,
        round: gameStore.currentRound,
        timestamp: Date.now(),
        word,
        scores: gameStore.points,
        players: gameStore.players,
        correctGuessers: gameStore.correctGuessers,
      }

      // Store round data to Arweave
      const txId = await storeGameState(gameCode as string, roundData, arweaveWallet)
      console.log("Round data stored to Arweave:", txId)
      toast.success("Round data stored to Arweave")
    } catch (error) {
      console.error("Error storing round data to Arweave:", error)
      toast.error("Failed to store round data to Arweave")
    } finally {
      setSavingToArweave(false)
    }
  }

  // Function to store game data to Arweave
  const storeGameDataToArweave = async (winner: string, points: any, totalPrize: string) => {
    if (!arweaveWallet || !gameCode) return

    try {
      setSavingToArweave(true)
      
      // Store game result
      const gameResult = {
        gameCode,
        winner,
        points,
        totalPrize,
        timestamp: Date.now(),
        players: gameStore.players,
      }

      // Store game result to Arweave
      const resultTxId = await storeGameResult(gameCode as string, gameResult, arweaveWallet)
      console.log("Game result stored to Arweave:", resultTxId)

      // Store chat history
      const chatHistoryTxId = await storeChatHistory(
        gameCode as string, 
        { messages: gameStore.chatMessages },
        arweaveWallet
      )
      console.log("Chat history stored to Arweave:", chatHistoryTxId)

      toast.success("Game data saved to Arweave")

      // Return transaction IDs for reference
      return {
        resultTxId,
        chatHistoryTxId,
      }
    } catch (error) {
      console.error("Error storing game data to Arweave:", error)
      toast.error("Failed to store game data to Arweave")
    } finally {
      setSavingToArweave(false)
    }
  }

  // Render loading state
  if (isConnecting) {
    return <LoadingOverlay message="Connecting to game server..." />
  }

  // Render error state
  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1F48B0] to-[#4A0E8F]">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center bg-white/15 rounded-3xl p-8 border border-white/20 shadow-lg"
        >
          <h2 className="text-2xl font-bold text-red-400 mb-4">{connectionError}</h2>
          <Button
            onClick={handleLeaveGame}
            className="px-6 py-3 bg-gradient-to-r from-[#4CAF50] to-[#45a049] hover:from-[#45a049] hover:to-[#4CAF50] text-white rounded-full font-semibold transition-all duration-300 ease-in-out transform hover:scale-105"
          >
            Return Home
          </Button>
        </motion.div>
      </div>
    )
  }

  // Main game UI
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-[#1F48B0] to-[#4A0E8F] overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-wrap justify-between items-center p-3 md:p-4 bg-white/15 border-b border-white/20 text-white"
      >
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto mb-2 md:mb-0">
          <Button onClick={handleLeaveGame} variant="ghost" className="text-white hover:bg-white/10" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1 md:mr-2" />
            <span className="text-sm md:text-base">Leave</span>
          </Button>

          <h2 className="text-lg md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-white truncate max-w-[150px] md:max-w-none">
            Game: {gameCode}
          </h2>

          <motion.span
            className="px-2 py-1 md:px-4 md:py-2 bg-white/20 rounded-full flex items-center text-sm md:text-base"
            animate={{ scale: gameStore.timeLeft <= 10 ? [1, 1.1, 1] : 1 }}
            transition={{ duration: 0.5, repeat: gameStore.timeLeft <= 10 ? Number.POSITIVE_INFINITY : 0 }}
          >
            <Clock className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            {gameStore.timeLeft}s
          </motion.span>
        </div>

        <div className="flex items-center justify-between w-full md:w-auto">
          {!gameStore.isGameStarted && gameStore.isOwner && gameStore.players.length >= 2 && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="mr-2">
              <Button
                onClick={handleStartGame}
                className="bg-gradient-to-r from-[#4CAF50] to-[#45a049] hover:from-[#45a049] hover:to-[#4CAF50] text-white font-semibold py-1 px-3 md:py-2 md:px-6 rounded-full transition-all duration-300 ease-in-out text-sm md:text-base"
              >
                Start Game
              </Button>
            </motion.div>
          )}

          {gameStore.isDrawing && gameStore.currentWord && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-3 py-1 md:px-6 md:py-3 bg-white/20 rounded-full font-semibold text-sm md:text-base"
            >
              Draw: <span className="font-bold text-[#FFEB3B]">{gameStore.currentWord}</span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Main content */}
      <div className="flex flex-1 flex-col md:flex-row p-2 md:p-4 gap-2 md:gap-4 text-white overflow-hidden">
        {/* Drawing area */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full md:w-3/5 flex flex-col gap-2 md:gap-4 bg-white/15 rounded-2xl md:rounded-3xl p-2 md:p-4 border border-white/20 shadow-lg overflow-hidden"
        >
          <div className="flex-1 relative">
            {socket && <DrawingCanvas socket={socket} />}
          </div>
        </motion.div>

        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="w-full md:w-2/5 flex flex-col gap-2 md:gap-4 overflow-hidden"
        >
          {/* Arweave Wallet */}
          <div className="bg-white/15 rounded-2xl md:rounded-3xl p-3 md:p-4 border border-white/20 shadow-lg">
            <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-white">
              Arweave Integration
            </h3>
            <ArweaveWalletFull onWalletConnect={handleArweaveWalletConnect} />
            
            {isSavingToArweave && (
              <div className="mt-3 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-white"></div>
                <p className="text-sm text-white/80 mt-2">Saving data to Arweave...</p>
              </div>
            )}
          </div>

          {/* Players */}
          <div className="bg-white/15 rounded-2xl md:rounded-3xl p-3 md:p-4 border border-white/20 shadow-lg">
            <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-white flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Players
            </h3>
            <div className="space-y-1 md:space-y-2 max-h-[20vh] md:max-h-[20vh] overflow-y-auto pr-1">
              <AnimatePresence>
                {gameStore.players.map((player) => (
                  <motion.div
                    key={player.address}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.3 }}
                    className="flex justify-between items-center bg-white/5 rounded-full px-3 py-1 md:px-4 md:py-2 transition-all duration-300 ease-in-out hover:bg-white/10 text-sm md:text-base"
                  >
                    <span className="flex items-center truncate max-w-[70%]">
                      {player.address === gameStore.currentDrawer && (
                        <Palette className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-[#FFEB3B] flex-shrink-0" />
                      )}
                      <span className="truncate">{player.name || `Player ${player.address.slice(0, 6)}...`}</span>
                    </span>
                    <motion.span
                      className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FF4B4B] to-[#FFEB3B] flex-shrink-0"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 0.5 }}
                    >
                      {gameStore.points[player.address] || 0}
                    </motion.span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 min-h-0">
            <Chat socket={socket} />
          </div>
          
          {/* Arweave Status */}
          {arweaveWallet && (
            <div className="bg-white/15 rounded-2xl p-3 border border-white/20 shadow-lg text-center">
              <span className="inline-flex items-center text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Connected to Arweave - Game data will be permanently stored
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}




// "use client"

// import { useEffect, useState, useCallback, useRef } from "react"
// import { useRouter } from "next/router"
// import { useAccount } from "wagmi"
// import { toast } from "react-hot-toast"
// import { io, type Socket } from "socket.io-client"
// import { DrawingCanvas } from "./DrawingCanvasArweave"
// import { Chat } from "./Chat"
// import { LoadingOverlay } from "./LoadingOverlay"
// import { ArweaveWalletFull } from "./ArweaveWalletFull"
// import { useScribbleContract } from "@/hooks/useScribbleContract"
// import { useGameStore } from "@/store/gameStore"
// import { Clock, Users, Palette, ArrowLeft } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import { motion, AnimatePresence } from "framer-motion"
// import { storeGameState, storeGameResult, storeChatHistory } from "@/services/gameStorageService"

// export const GameRoomArweave = () => {
//   const [socket, setSocket] = useState<Socket | null>(null)
//   const [isConnecting, setIsConnecting] = useState(true)
//   const [connectionError, setConnectionError] = useState<string | null>(null)
//   const [arweaveWallet, setArweaveWallet] = useState<any>(null)
//   const [isSavingToArweave, setSavingToArweave] = useState(false)

//   const isInitializedRef = useRef(false)

//   const router = useRouter()
//   const { gameCode } = router.query
//   const { address } = useAccount()
//   const { startGame, recordWordDrawn, recordCorrectGuess, forceEndRound, getRoomDetails } = useScribbleContract()
//   const gameStore = useGameStore()

//   // Handle Arweave wallet connection
//   const handleArweaveWalletConnect = (wallet: any) => {
//     setArweaveWallet(wallet)
//     console.log("Arweave wallet connected:", wallet ? "Yes" : "No")
//   }

//   // Memoize these functions to prevent unnecessary re-renders
//   const handleStartGame = useCallback(async () => {
//     if (!gameCode) return

//     try {
//       // First notify the socket server
//       if (socket) {
//         socket.emit("startGame")
//       }

//       // Then start the game on the blockchain
//       await startGame(gameCode as string)
//     } catch (error) {
//       console.error("Error starting game:", error)
//       toast.error("Failed to start game", { style: { zIndex: 9999 } })
//     }
//   }, [gameCode, socket, startGame])

//   const handleLeaveGame = useCallback(async () => {
//     try {
//       gameStore.reset()
//       await router.push("/")
//     } catch (error) {
//       console.error("Navigation error:", error)
//       window.location.href = "/"
//     }
//   }, [gameStore, router])

//   // Connect to socket server and setup event listeners
//   useEffect(() => {
//     // To prevent multiple initializations
//     if (isInitializedRef.current) return
//     isInitializedRef.current = true

//     // Prevent useEffect from running without required data
//     if (!gameCode || !address) {
//       isInitializedRef.current = false
//       return
//     }

//     let socketInstance: Socket | null = null
//     let isComponentMounted = true

//     const setupSocket = async () => {
//       console.log("Setting up socket connection for game:", gameCode)

//       const playerName = localStorage.getItem("playerName") || `Player ${address.slice(0, 6)}`

//       // Verify that the environment variable is set
//       const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
//       if (!socketUrl) {
//         console.error("Socket URL environment variable is not set")
//         if (isComponentMounted) {
//           setConnectionError("Socket server URL is not configured")
//           setIsConnecting(false)
//         }
//         return
//       }

//       // Create socket instance with explicit URL for better debugging
//       try {
//         socketInstance = io(socketUrl, {
//           query: {
//             gameCode,
//             address,
//             name: playerName,
//           },
//           transports: ["websocket", "polling"],
//           reconnectionAttempts: 3,
//           timeout: 10000,
//         })

//         // Connect event handler
//         socketInstance.on("connect", async () => {
//           console.log("Socket connected successfully")
//           if (isComponentMounted) {
//             setIsConnecting(false)
//             setConnectionError(null)
//           }

//           // Send wager amount to server
//           try {
//             if (getRoomDetails) {
//               const details = await getRoomDetails(gameCode as string)
//               if (details && details.wagerAmount) {
//                 console.log("Found wager amount:", details.wagerAmount.toString())
//                 socketInstance?.emit("setWagerAmount", details.wagerAmount.toString())
//               }
//             }
//           } catch (error) {
//             console.error("Error getting room details:", error)
//           }
//         })

//         // Connection error handler
//         socketInstance.on("connect_error", (error) => {
//           console.error("Socket connection error:", error)
//           if (isComponentMounted) {
//             setConnectionError("Failed to connect to game server")
//             setIsConnecting(false)
//           }
//           toast.error("Failed to connect to game server", { style: { zIndex: 9999 } })
//         })

//         // Game state handler
//         socketInstance.on("gameState", (state) => {
//           if (!isComponentMounted) return

//           console.log("Received game state:", state)
//           gameStore.setCurrentDrawer(state.currentDrawer)
//           gameStore.setCurrentWord(state.currentWord)
//           gameStore.setTimeLeft(state.timeLeft)
//           gameStore.setPlayers(state.players)
//           gameStore.setIsDrawing(state.currentDrawer === address)
//           gameStore.setIsGameStarted(state.isGameStarted)
//           gameStore.setRoundActive(state.roundActive)

//           if (state.players.length > 0) {
//             // In the new contract, the room creator is the owner
//             gameStore.setIsOwner(state.players[0].address === address)
//           }
//         })

//         // Time update handler
//         socketInstance.on("timeUpdate", (time) => {
//           if (isComponentMounted) {
//             gameStore.setTimeLeft(time)
//           }
//         })

//         // Round start handler
//         socketInstance.on("roundStart", ({ drawer, word, timeLeft }) => {
//           if (!isComponentMounted) return

//           gameStore.setCurrentDrawer(drawer)
//           gameStore.setRoundActive(true)
//           gameStore.setTimeLeft(timeLeft)
//           gameStore.setIsDrawing(drawer === address)

//           if (drawer === address) {
//             gameStore.setCurrentWord(word)
//             toast.success("Your turn to draw!", { style: { zIndex: 9999 } })

//             // Record the word being drawn on the blockchain
//             try {
//               recordWordDrawn(gameCode as string, word)
//             } catch (error) {
//               console.error("Error recording word:", error)
//             }
//           } else {
//             gameStore.setCurrentWord("")
//             toast.success("Time to guess!", { style: { zIndex: 9999 } })
//           }
//           gameStore.clearCorrectGuessers()
//         })

//         // Round end handler
//         socketInstance.on("roundEnd", ({ scores, nextDrawer, word }) => {
//           if (!isComponentMounted) return

//           gameStore.setRoundActive(false)
//           gameStore.setCurrentDrawer(nextDrawer)
//           gameStore.setCurrentWord("")
//           gameStore.setIsDrawing(nextDrawer === address)

//           // Update points in the store
//           Object.entries(scores).forEach(([player, points]) => {
//             gameStore.updatePoints(player, points as number)
//           })

//           toast("Round ended! The word was: " + word, {
//             icon: "🔄",
//             style: {
//               background: "#3b82f6",
//               color: "#ffffff",
//               zIndex: 9999,
//             },
//             duration: 3000,
//           })

//           // If we're the room creator, we might need to force end the round
//           if (gameStore.isOwner && gameStore.timeLeft <= 0) {
//             try {
//               forceEndRound(gameCode as string)
//             } catch (error) {
//               console.error("Error forcing round end:", error)
//             }
//           }

//           // If we have an Arweave wallet, store the round state
//           if (arweaveWallet && gameStore.isOwner) {
//             storeRoundDataToArweave(word)
//           }
//         })

//         // Wrong guess handler
//         socketInstance.on("wrongGuess", ({ guess }) => {
//           toast.error(`Wrong guess: ${guess}`, { duration: 2000, style: { zIndex: 9999 } })
//         })

//         // Correct guess handler
//         socketInstance.on("correctGuess", ({ player, points }) => {
//           if (!isComponentMounted) return

//           gameStore.updatePoints(player, points)
//           gameStore.addCorrectGuesser(player)

//           toast.success(`${player === address ? "You" : "Someone"} guessed correctly!`, {
//             duration: 3000,
//             style: { zIndex: 9999 },
//           })

//           // If we're the room owner, record the correct guess on the blockchain
//           if (gameStore.isOwner) {
//             try {
//               recordCorrectGuess(gameCode as string, player, gameStore.timeLeft)
//             } catch (error) {
//               console.error("Error recording correct guess:", error)
//             }
//           }
//         })

//         // Chat message handler
//         socketInstance.on("chatMessage", (message) => {
//           if (isComponentMounted) {
//             gameStore.addChatMessage(message)
//           }
//         })

//         // Game end handler
//         socketInstance.on("gameEnd", async ({ winner, points, totalPrize }) => {
//           if (!isComponentMounted) return

//           console.log("Game ended! Winner:", winner)
//           console.log("Prize amount:", totalPrize)

//           const isWinner = winner === address

//           // Store game results to Arweave if we have a wallet and we're the winner or the owner
//           if (arweaveWallet && (isWinner || gameStore.isOwner)) {
//             await storeGameDataToArweave(winner, points, totalPrize)
//           }

//           // Create a modal to show the winner and prize
//           // (This part can remain similar to your original implementation)
//           toast.success(`Game over! Winner: ${winner.substring(0, 6)}...`, {
//             duration: 5000,
//             style: { zIndex: 9999 },
//           })

//           // Navigate to the home page after a delay
//           setTimeout(() => {
//             router.push("/")
//           }, 5000)
//         })

//         // Transaction events can remain similar to your original implementation

//         // Save socket instance
//         if (isComponentMounted) {
//           setSocket(socketInstance)
//         }
//       } catch (error) {
//         console.error("Error creating socket connection:", error)
//         if (isComponentMounted) {
//           setConnectionError("Failed to initialize connection to game server")
//           setIsConnecting(false)
//         }
//       }
//     }

//     setupSocket()

//     // Cleanup function
//     return () => {
//       console.log("Cleaning up socket connection")
//       isComponentMounted = false
//       isInitializedRef.current = false

//       if (socketInstance) {
//         socketInstance.disconnect()
//       }
//     }
//   }, [gameCode, address, getRoomDetails, recordWordDrawn, recordCorrectGuess, forceEndRound, gameStore, router, arweaveWallet])

//   // Function to store round data to Arweave
//   const storeRoundDataToArweave = async (word: string) => {
//     if (!arweaveWallet || !gameCode) return

//     try {
//       setSavingToArweave(true)
      
//       // Get current round data
//       const roundData = {
//         gameCode,
//         round: gameStore.currentRound,
//         timestamp: Date.now(),
//         word,
//         scores: gameStore.points,
//         players: gameStore.players,
//         correctGuessers: gameStore.correctGuessers,
//       }

//       // Store round data to Arweave
//       const txId = await storeGameState(gameCode as string, roundData, arweaveWallet)
//       console.log("Round data stored to Arweave:", txId)
//       toast.success("Round data stored to Arweave")
//     } catch (error) {
//       console.error("Error storing round data to Arweave:", error)
//       toast.error("Failed to store round data to Arweave")
//     } finally {
//       setSavingToArweave(false)
//     }
//   }

//   // Function to store game data to Arweave
//   const storeGameDataToArweave = async (winner: string, points: any, totalPrize: string) => {
//     if (!arweaveWallet || !gameCode) return

//     try {
//       setSavingToArweave(true)
      
//       // Store game result
//       const gameResult = {
//         gameCode,
//         winner,
//         points,
//         totalPrize,
//         timestamp: Date.now(),
//         players: gameStore.players,
//       }

//       // Store game result to Arweave
//       const resultTxId = await storeGameResult(gameCode as string, gameResult, arweaveWallet)
//       console.log("Game result stored to Arweave:", resultTxId)

//       // Store chat history
//       const chatHistoryTxId = await storeChatHistory(
//         gameCode as string, 
//         { messages: gameStore.chatMessages },
//         arweaveWallet
//       )
//       console.log("Chat history stored to Arweave:", chatHistoryTxId)

//       toast.success("Game data saved to Arweave")

//       // Return transaction IDs for reference
//       return {
//         resultTxId,
//         chatHistoryTxId,
//       }
//     } catch (error) {
//       console.error("Error storing game data to Arweave:", error)
//       toast.error("Failed to store game data to Arweave")
//     } finally {
//       setSavingToArweave(false)
//     }
//   }

//   // Render loading state
//   if (isConnecting) {
//     return <LoadingOverlay message="Connecting to game server..." />
//   }

//   // Render error state
//   if (connectionError) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1F48B0] to-[#4A0E8F]">
//         <motion.div
//           initial={{ opacity: 0, y: -20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.5 }}
//           className="text-center bg-white/15 rounded-3xl p-8 border border-white/20 shadow-lg"
//         >
//           <h2 className="text-2xl font-bold text-red-400 mb-4">{connectionError}</h2>
//           <Button
//             onClick={handleLeaveGame}
//             className="px-6 py-3 bg-gradient-to-r from-[#4CAF50] to-[#45a049] hover:from-[#45a049] hover:to-[#4CAF50] text-white rounded-full font-semibold transition-all duration-300 ease-in-out transform hover:scale-105"
//           >
//             Return Home
//           </Button>
//         </motion.div>
//       </div>
//     )
//   }

//   // Main game UI
//   return (
//     <div className="flex flex-col h-screen bg-gradient-to-br from-[#1F48B0] to-[#4A0E8F] overflow-hidden">
//       {/* Header */}
//       <motion.div
//         initial={{ opacity: 0, y: -20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.5 }}
//         className="flex flex-wrap justify-between items-center p-3 md:p-4 bg-white/15 border-b border-white/20 text-white"
//       >
//         <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto mb-2 md:mb-0">
//           <Button onClick={handleLeaveGame} variant="ghost" className="text-white hover:bg-white/10" size="sm">
//             <ArrowLeft className="w-4 h-4 mr-1 md:mr-2" />
//             <span className="text-sm md:text-base">Leave</span>
//           </Button>

//           <h2 className="text-lg md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-white truncate max-w-[150px] md:max-w-none">
//             Game: {gameCode}
//           </h2>

//           <motion.span
//             className="px-2 py-1 md:px-4 md:py-2 bg-white/20 rounded-full flex items-center text-sm md:text-base"
//             animate={{ scale: gameStore.timeLeft <= 10 ? [1, 1.1, 1] : 1 }}
//             transition={{ duration: 0.5, repeat: gameStore.timeLeft <= 10 ? Number.POSITIVE_INFINITY : 0 }}
//           >
//             <Clock className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
//             {gameStore.timeLeft}s
//           </motion.span>
//         </div>

//         <div className="flex items-center justify-between w-full md:w-auto">
//           {!gameStore.isGameStarted && gameStore.isOwner && gameStore.players.length >= 2 && (
//             <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="mr-2">
//               <Button
//                 onClick={handleStartGame}
//                 className="bg-gradient-to-r from-[#4CAF50] to-[#45a049] hover:from-[#45a049] hover:to-[#4CAF50] text-white font-semibold py-1 px-3 md:py-2 md:px-6 rounded-full transition-all duration-300 ease-in-out text-sm md:text-base"
//               >
//                 Start Game
//               </Button>
//             </motion.div>
//           )}

//           {gameStore.isDrawing && gameStore.currentWord && (
//             <motion.div
//               initial={{ opacity: 0, y: -20 }}
//               animate={{ opacity: 1, y: 0 }}
//               className="px-3 py-1 md:px-6 md:py-3 bg-white/20 rounded-full font-semibold text-sm md:text-base"
//             >
//               Draw: <span className="font-bold text-[#FFEB3B]">{gameStore.currentWord}</span>
//             </motion.div>
//           )}
//         </div>
//       </motion.div>

//       {/* Main content */}
//       <div className="flex flex-1 flex-col md:flex-row p-2 md:p-4 gap-2 md:gap-4 text-white overflow-hidden">
//         {/* Drawing area */}
//         <motion.div
//           initial={{ opacity: 0, x: -20 }}
//           animate={{ opacity: 1, x: 0 }}
//           transition={{ duration: 0.5, delay: 0.2 }}
//           className="w-full md:w-3/5 flex flex-col gap-2 md:gap-4 bg-white/15 rounded-2xl md:rounded-3xl p-2 md:p-4 border border-white/20 shadow-lg overflow-hidden"
//         >
//           <div className="flex-1 relative">
//             {socket && <DrawingCanvas socket={socket} />}
//           </div>
//         </motion.div>

//         {/* Sidebar */}
//         <motion.div
//           initial={{ opacity: 0, x: 20 }}
//           animate={{ opacity: 1, x: 0 }}
//           transition={{ duration: 0.5, delay: 0.4 }}
//           className="w-full md:w-2/5 flex flex-col gap-2 md:gap-4 overflow-hidden"
//         >
//           {/* Arweave Wallet */}
//           <div className="bg-white/15 rounded-2xl md:rounded-3xl p-3 md:p-4 border border-white/20 shadow-lg">
//             <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-white">
//               Arweave Integration
//             </h3>
//             <ArweaveWalletFull onWalletConnect={handleArweaveWalletConnect} />
            
//             {isSavingToArweave && (
//               <div className="mt-3 text-center">
//                 <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-white"></div>
//                 <p className="text-sm text-white/80 mt-2">Saving data to Arweave...</p>
//               </div>
//             )}
//           </div>

//           {/* Players */}
//           <div className="bg-white/15 rounded-2xl md:rounded-3xl p-3 md:p-4 border border-white/20 shadow-lg">
//             <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-white flex items-center">
//               <Users className="w-4 h-4 mr-2" />
//               Players
//             </h3>
//             <div className="space-y-1 md:space-y-2 max-h-[20vh] md:max-h-[20vh] overflow-y-auto pr-1">
//               <AnimatePresence>
//                 {gameStore.players.map((player) => (
//                   <motion.div
//                     key={player.address}
//                     initial={{ opacity: 0, y: -10 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     exit={{ opacity: 0, y: 10 }}
//                     transition={{ duration: 0.3 }}
//                     className="flex justify-between items-center bg-white/5 rounded-full px-3 py-1 md:px-4 md:py-2 transition-all duration-300 ease-in-out hover:bg-white/10 text-sm md:text-base"
//                   >
//                     <span className="flex items-center truncate max-w-[70%]">
//                       {player.address === gameStore.currentDrawer && (
//                         <Palette className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-[#FFEB3B] flex-shrink-0" />
//                       )}
//                       <span className="truncate">{player.name || `Player ${player.address.slice(0, 6)}...`}</span>
//                     </span>
//                     <motion.span
//                       className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FF4B4B] to-[#FFEB3B] flex-shrink-0"
//                       animate={{ scale: [1, 1.1, 1] }}
//                       transition={{ duration: 0.5 }}
//                     >
//                       {gameStore.points[player.address] || 0}
//                     </motion.span>
//                   </motion.div>
//                 ))}
//               </AnimatePresence>
//             </div>
//           </div>

//           {/* Chat */}
//           <div className="flex-1 min-h-0">
//             <Chat socket={socket} />
//           </div>
          
//           {/* Arweave Status */}
//           {arweaveWallet && (
//             <div className="bg-white/15 rounded-2xl p-3 border border-white/20 shadow-lg text-center">
//               <span className="inline-flex items-center text-sm">
//                 <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
//                 Connected to Arweave - Game data will be permanently stored
//               </span>
//             </div>
//           )}
//         </motion.div>
//       </div>
//     </div>
// )}