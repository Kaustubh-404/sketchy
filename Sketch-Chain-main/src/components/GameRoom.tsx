"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/router"
import { useAccount } from "wagmi"
import { toast } from "react-hot-toast"
import { io, type Socket } from "socket.io-client"
import { DrawingCanvas } from "./DrawingCanvas"
// import { DrawingTools } from "./DrawingTools"
import { Chat } from "./Chat"
import { LoadingOverlay } from "./LoadingOverlay"
import { useScribbleContract } from "@/hooks/useScribbleContract"
import { useGameStore } from "@/store/gameStore"
import { Clock, Users, Palette, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

// Define global window types for our game result elements
declare global {
  interface Window {
    __gameResultElements?: {
      modalElement: HTMLDivElement
      loadingIndicator: HTMLElement | null
      txHashContainer: HTMLElement | null
      button: HTMLButtonElement
      autoRedirectTimer: NodeJS.Timeout | null
    }
  }
}

// Define proper type for the transaction data
interface ConfirmedTransaction {
  winner: string
  transactionHash: string
  confirmed: boolean
}

// Store the confirmed transaction data for later use
let confirmedTransactionData: ConfirmedTransaction | null = null

export const GameRoom = () => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const isInitializedRef = useRef(false)

  const router = useRouter()
  const { gameCode } = router.query
  const { address } = useAccount()
  // const publicClient = usePublicClient()
  const { startGame, recordWordDrawn, recordCorrectGuess, forceEndRound, getRoomDetails } = useScribbleContract()
  const gameStore = useGameStore()

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

        // Transaction confirmed event - Store transaction data and update UI if modal exists
        socketInstance.on("transactionConfirmed", ({ winner, transactionHash }) => {
          if (!isComponentMounted) return

          console.log("Prize transfer confirmed!", transactionHash)

          // Only process if you're the winner
          if (winner !== address) return

          // Store transaction data for later use
          confirmedTransactionData = {
            winner,
            transactionHash,
            confirmed: true,
          }

          // Try to update UI if modal exists
          updateTransactionUI(winner, transactionHash)
        })

        // Function to update transaction UI - can be called from multiple places
        const updateTransactionUI = (winner: string, transactionHash: string): boolean => {
          try {
            console.log("Attempting to update transaction UI with hash:", transactionHash)

            // Find modal element
            const modalElement = document.getElementById("game-result-modal")
            if (!modalElement) {
              console.log("Modal element not found yet - will update when modal appears")
              return false // Signal that update wasn't completed
            }

            console.log("Found modal element, updating UI")

            // Find and hide loading indicator
            const loadingIndicator = document.getElementById("loading-indicator")
            if (loadingIndicator) {
              loadingIndicator.style.display = "none"
            }

            // Find or create transaction hash container
            let txHashContainer = document.getElementById("tx-hash-container")
            if (!txHashContainer) {
              // Try to find result box
              const resultBox = modalElement.querySelector('div[style*="backgroundColor"]')
              if (!resultBox) {
                console.log("Could not find result box")
                return false
              }

              // Create transaction hash container
              txHashContainer = document.createElement("div")
              txHashContainer.id = "tx-hash-container"
              txHashContainer.style.marginTop = "0.75rem"
              resultBox.appendChild(txHashContainer)
            }

            // Update transaction hash container
            txHashContainer.innerHTML = "" // Clear any existing content
            txHashContainer.style.display = "block"

            // Add confirmation message
            const confirmText = document.createElement("div")
            confirmText.style.color = "#15803d" // Green
            confirmText.style.fontWeight = "500"
            confirmText.style.marginBottom = "0.5rem"
            confirmText.textContent = "✓ Funds transferred successfully!"
            txHashContainer.appendChild(confirmText)

            // Add transaction hash info
            const hashLabel = document.createElement("p")
            hashLabel.style.fontSize = "0.875rem"
            hashLabel.style.color = "#92400e"
            hashLabel.style.marginBottom = "0.25rem"
            hashLabel.textContent = "Transaction Hash:"
            txHashContainer.appendChild(hashLabel)

            // Hash container with buttons
            const hashContainer = document.createElement("div")
            hashContainer.style.display = "flex"
            hashContainer.style.alignItems = "center"
            hashContainer.style.justifyContent = "center"
            hashContainer.style.backgroundColor = "rgba(254, 240, 138, 0.3)"
            hashContainer.style.padding = "0.25rem 0.75rem"
            hashContainer.style.borderRadius = "0.5rem"

            // Hash text
            const hashText = document.createElement("span")
            hashText.style.fontFamily = "monospace"
            hashText.textContent = `${transactionHash.substring(0, 6)}...${transactionHash.substring(transactionHash.length - 4)}`
            hashContainer.appendChild(hashText)

            // Copy button
            const copyBtn = document.createElement("button")
            copyBtn.innerHTML =
              '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'
            copyBtn.style.background = "none"
            copyBtn.style.border = "none"
            copyBtn.style.cursor = "pointer"
            copyBtn.style.color = "#92400e"
            copyBtn.style.marginLeft = "0.5rem"
            copyBtn.title = "Copy to clipboard"

            copyBtn.onclick = () => {
              navigator.clipboard
                .writeText(transactionHash)
                .then(() => {
                  toast.success("Hash copied to clipboard!", { duration: 2000, style: { zIndex: 9999 } })
                })
                .catch((err) => console.error("Failed to copy:", err))
            }
            hashContainer.appendChild(copyBtn)

            // Explorer button
            const explorerBtn = document.createElement("button")
            explorerBtn.innerHTML =
              '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>'
            explorerBtn.style.background = "none"
            explorerBtn.style.border = "none"
            explorerBtn.style.cursor = "pointer"
            explorerBtn.style.color = "#92400e"
            explorerBtn.style.marginLeft = "0.5rem"
            explorerBtn.title = "View on explorer"

            explorerBtn.onclick = () => {
              const explorerUrl = `https://scan.test.btcs.network/tx/${transactionHash}`
              window.open(explorerUrl, "_blank")
            }
            hashContainer.appendChild(explorerBtn)

            txHashContainer.appendChild(hashContainer)

            // Enable and style the button
            const button = modalElement.querySelector("button")
            if (button) {
              button.disabled = false
              button.style.cursor = "pointer"
              button.style.background = "linear-gradient(to right, #eab308, #facc15)"

              button.onmouseover = () => {
                button.style.background = "linear-gradient(to right, #ca8a04, #eab308)"
              }

              button.onmouseout = () => {
                button.style.background = "linear-gradient(to right, #eab308, #facc15)"
              }
            }

            return true // Signal that update was completed
          } catch (error) {
            console.error("Error updating transaction UI:", error)
            return false // Signal that update wasn't completed
          }
        }

        // Transaction failed event
        socketInstance.on("transactionFailed", ({ error }) => {
          console.error("Prize transfer failed:", error)

          toast.error("Error transferring prize. Please contact support.", {
            duration: 5000,
            style: { zIndex: 9999 },
          })

          // If we have the modal, update it
          if (window.__gameResultElements) {
            const { loadingIndicator, button } = window.__gameResultElements

            if (loadingIndicator && loadingIndicator.parentNode) {
              loadingIndicator.innerHTML =
                '<div style="color: #ef4444; margin-top: 0.5rem;">Failed to transfer prize. Please contact support.</div>'
            }

            // Enable button anyway
            if (button) {
              button.disabled = false
              button.style.cursor = "pointer"
              button.style.background = "linear-gradient(to right, #eab308, #facc15)"
            }
          }
        })

        // Transaction skipped event
        socketInstance.on("transactionSkipped", ({ reason }) => {
          if (!isComponentMounted) return

          console.warn("Prize transfer skipped:", reason)

          // Update the UI
          if (window.__gameResultElements) {
            const { loadingIndicator, button } = window.__gameResultElements

            if (loadingIndicator && loadingIndicator.parentNode) {
              loadingIndicator.innerHTML = `<div style="color: #f59e0b; margin-top: 0.5rem;">Prize transfer skipped: ${reason}</div>`
            }

            // Enable button anyway
            if (button) {
              button.disabled = false
              button.style.cursor = "pointer"
              button.style.background = "linear-gradient(to right, #eab308, #facc15)"
            }
          }
        })

        socketInstance.on("gameEnd", async ({ winner, totalPrize }) => {
          if (!isComponentMounted) return

          console.log("Game ended! Winner:", winner)
          console.log("Prize amount:", totalPrize)

          const isWinner = winner === address

          // Ensure totalPrize is properly handled
          let prizeBigInt
          try {
            prizeBigInt = totalPrize ? BigInt(totalPrize) : BigInt(0)
            console.log("Parsed prize amount:", prizeBigInt.toString())
          } catch (error) {
            console.error("Error parsing prize amount:", error)
            prizeBigInt = BigInt(0)
          }

          // Format prize for display
          const formattedPrize = (Number(totalPrize) / 10 ** 18).toFixed(2)

          try {
            // Check if a modal already exists, remove it if it does
            const existingModal = document.getElementById("game-result-modal")
            if (existingModal && existingModal.parentNode) {
              existingModal.parentNode.removeChild(existingModal)
            }

            window.localStorage.setItem("gameEnded", "true")

            // Create modal element
            const modalElement = document.createElement("div")
            modalElement.id = "game-result-modal"
            modalElement.style.position = "fixed"
            modalElement.style.zIndex = "9999"
            modalElement.style.top = "0"
            modalElement.style.left = "0"
            modalElement.style.width = "100%"
            modalElement.style.height = "100%"
            modalElement.style.backgroundColor = "rgba(0,0,0,0.7)"
            modalElement.style.display = "flex"
            modalElement.style.alignItems = "center"
            modalElement.style.justifyContent = "center"

            // Create modal content with appropriate styling
            const modalContent = document.createElement("div")
            modalContent.style.backgroundColor = isWinner ? "#fffbeb" : "#f0f9ff" // Yellow/blue background
            modalContent.style.padding = "2rem"
            modalContent.style.borderRadius = "1rem"
            modalContent.style.maxWidth = "500px"
            modalContent.style.width = "90%"
            modalContent.style.textAlign = "center"
            modalContent.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)"
            modalContent.style.border = isWinner ? "2px solid #fde68a" : "2px solid #bfdbfe"

            // Add modal header with winner/loser styling
            const header = document.createElement("h2")
            header.style.fontSize = "28px"
            header.style.fontWeight = "bold"
            header.style.marginBottom = "1.5rem"
            header.style.color = isWinner ? "#854d0e" : "#1e40af"
            header.textContent = isWinner ? "🎉 Victory! 🎉" : "Keep Drawing!"

            // Add subtext
            const subtext = document.createElement("p")
            subtext.style.fontSize = "18px"
            subtext.style.marginBottom = "1.5rem"
            subtext.style.color = isWinner ? "#92400e" : "#1e3a8a"
            subtext.textContent = isWinner ? "Congratulations, you've won!" : "Better luck next time! 🎨"

            // Create result box
            const resultBox = document.createElement("div")
            resultBox.style.backgroundColor = isWinner ? "rgba(254, 240, 138, 0.3)" : "rgba(191, 219, 254, 0.3)"
            resultBox.style.padding = "1.5rem"
            resultBox.style.borderRadius = "0.75rem"
            resultBox.style.marginTop = "1rem"
            resultBox.style.marginBottom = "1.5rem"

            // Add box title
            const boxTitle = document.createElement("p")
            boxTitle.style.fontWeight = "600"
            boxTitle.style.color = isWinner ? "#92400e" : "#1e40af"
            boxTitle.textContent = isWinner ? "Prize Won" : "Game Results"
            resultBox.appendChild(boxTitle)

            if (isWinner) {
              // Prize amount
              const prizeAmount = document.createElement("p")
              prizeAmount.style.fontSize = "24px"
              prizeAmount.style.fontWeight = "bold"
              prizeAmount.style.color = "#78350f"
              prizeAmount.style.margin = "0.5rem 0"
              prizeAmount.textContent = `${formattedPrize} CORE`
              resultBox.appendChild(prizeAmount)

              // Check if we already have confirmed transaction data
              const showTransactionInfo =
                confirmedTransactionData &&
                confirmedTransactionData.winner === address &&
                confirmedTransactionData.confirmed

              if (showTransactionInfo) {
                console.log("Using pre-confirmed transaction data:", confirmedTransactionData?.transactionHash)

                // Create confirmed transaction display
                const txHashDiv = document.createElement("div")
                txHashDiv.id = "tx-hash-container"
                txHashDiv.style.marginTop = "0.75rem"
                resultBox.appendChild(txHashDiv)

                // We'll populate this after adding to DOM
              } else {
                // Loading indicator for transaction
                const loadingDiv = document.createElement("div")
                loadingDiv.id = "loading-indicator"
                loadingDiv.style.display = "flex"
                loadingDiv.style.alignItems = "center"
                loadingDiv.style.justifyContent = "center"
                loadingDiv.style.marginTop = "0.75rem"

                const loadingText = document.createElement("span")
                loadingText.textContent = "Transferring funds to your wallet..."
                loadingText.style.color = "#92400e"
                loadingText.style.marginLeft = "0.5rem"

                // Create a simple spinner
                const spinner = document.createElement("div")
                spinner.style.border = "3px solid rgba(0, 0, 0, 0.1)"
                spinner.style.borderTopColor = "#92400e"
                spinner.style.borderRadius = "50%"
                spinner.style.width = "16px"
                spinner.style.height = "16px"
                spinner.style.animation = "spin 1s linear infinite"

                // Add keyframes for spinner
                const style = document.createElement("style")
                style.textContent = `
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `
                document.head.appendChild(style)

                loadingDiv.appendChild(spinner)
                loadingDiv.appendChild(loadingText)
                resultBox.appendChild(loadingDiv)

                // Create empty container for transaction hash (initially hidden)
                const txHashDiv = document.createElement("div")
                txHashDiv.id = "tx-hash-container"
                txHashDiv.style.display = "none"
                txHashDiv.style.marginTop = "0.75rem"
                resultBox.appendChild(txHashDiv)
              }
            } else {
              // Winner info for losers
              const winnerInfo = document.createElement("div")
              winnerInfo.style.display = "flex"
              winnerInfo.style.alignItems = "center"
              winnerInfo.style.justifyContent = "center"
              winnerInfo.style.marginTop = "0.5rem"
              winnerInfo.style.marginBottom = "0.75rem"

              const winnerLabel = document.createElement("span")
              winnerLabel.textContent = `Winner: ${winner.substring(0, 6)}...${winner.substring(winner.length - 4)}`
              winnerLabel.style.fontWeight = "600"
              winnerLabel.style.color = "#1e40af"

              winnerInfo.appendChild(winnerLabel)
              resultBox.appendChild(winnerInfo)

              // Prize amount for losers
              const prizeInfo = document.createElement("p")
              prizeInfo.style.color = "#1e40af"
              prizeInfo.innerHTML = `Prize amount: <span style="font-weight: 600;">${formattedPrize} CORE</span>`
              resultBox.appendChild(prizeInfo)
            }

            // Add button with styling
            const button = document.createElement("button")
            button.textContent = "Okay"
            button.style.marginTop = "1.5rem"
            button.style.padding = "0.75rem 2rem"
            button.style.borderRadius = "9999px"
            button.style.fontWeight = "600"
            button.style.color = "white"
            button.style.border = "none"
            button.style.transition = "all 0.3s ease"

            // If winner and transaction already confirmed, enable button immediately
            const transactionAlreadyConfirmed =
              isWinner && confirmedTransactionData && confirmedTransactionData.confirmed

            if (isWinner && !transactionAlreadyConfirmed) {
              button.style.backgroundColor = "#9ca3af" // Gray for winner until confirmed
              button.style.cursor = "not-allowed"
              button.disabled = true
            } else {
              button.style.background = isWinner
                ? "linear-gradient(to right, #eab308, #facc15)"
                : "linear-gradient(to right, #3b82f6, #60a5fa)"
              button.style.cursor = "pointer"

              button.onmouseover = () => {
                button.style.background = isWinner
                  ? "linear-gradient(to right, #ca8a04, #eab308)"
                  : "linear-gradient(to right, #2563eb, #3b82f6)"
              }

              button.onmouseout = () => {
                button.style.background = isWinner
                  ? "linear-gradient(to right, #eab308, #facc15)"
                  : "linear-gradient(to right, #3b82f6, #60a5fa)"
              }
            }

            button.onclick = () => {
              // IMPORTANT: Remove the timeout when user clicks button
              if (window.__gameResultElements?.autoRedirectTimer) {
                clearTimeout(window.__gameResultElements.autoRedirectTimer)
              }

              // Only remove the modal if it still exists
              if (document.body.contains(modalElement)) {
                document.body.removeChild(modalElement)
              }

              window.localStorage.removeItem("gameEnded")

              // Navigate to home page
              window.location.href = "/"
            }

            // Store elements in window object for access in transactionConfirmed handler
            window.__gameResultElements = {
              modalElement,
              loadingIndicator: null, // We'll set this after appending to DOM
              txHashContainer: null, // We'll set this after appending to DOM
              button,
              autoRedirectTimer: null,
            }

            // Store game result in local storage
            const gameResult = {
              gameCode: gameCode as string,
              winner: winner,
              prizeAmount: totalPrize,
              timestamp: Date.now(),
            }

            const history = JSON.parse(localStorage.getItem("gameHistory") || "[]")
            history.push(gameResult)
            localStorage.setItem("gameHistory", JSON.stringify(history))

            // Append elements
            modalContent.appendChild(header)
            modalContent.appendChild(subtext)
            modalContent.appendChild(resultBox)
            modalContent.appendChild(button)
            modalElement.appendChild(modalContent)

            // Add to body
            document.body.appendChild(modalElement)

            // Get references AFTER adding to DOM
            window.__gameResultElements.loadingIndicator = document.getElementById("loading-indicator")
            window.__gameResultElements.txHashContainer = document.getElementById("tx-hash-container")

            // If transaction was already confirmed, update UI immediately
            if (isWinner && confirmedTransactionData && confirmedTransactionData.confirmed) {
              console.log("Applying stored transaction data to UI")
              setTimeout(() => {
                if (confirmedTransactionData) {
                  updateTransactionUI(confirmedTransactionData.winner, confirmedTransactionData.transactionHash)
                }
              }, 100) // Small delay to ensure DOM is ready
            }

            // Add a super long timeout as fallback (5 minutes)
            window.__gameResultElements.autoRedirectTimer = setTimeout(() => {
              console.log("Auto-redirecting after long timeout...")
              if (document.body.contains(modalElement)) {
                document.body.removeChild(modalElement)
                window.location.href = "/"
              }
            }, 300000) // 5 minutes
          } catch (error: unknown) {
            console.error("Error handling game end:", error)
            if (error instanceof Error) {
              console.error("Specific error:", error.message)
              console.error("Error stack:", error.stack)
            }
            // Fallback to simpler end game handling without UI
            toast.error(`Game ended! ${isWinner ? "You won!" : "Better luck next time!"}`, { style: { zIndex: 9999 } })
            setTimeout(() => {
              window.location.href = "/"
            }, 5000)
          }
        })

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

      const gameEnded = window.localStorage.getItem("gameEnded") === "true"
      const resultModalShowing = !!document.getElementById("game-result-modal")

      if (socketInstance && !gameEnded && !resultModalShowing) {
        socketInstance.disconnect()
      }

      // Clean up modal if it exists
      if (window.__gameResultElements?.autoRedirectTimer) {
        clearTimeout(window.__gameResultElements.autoRedirectTimer)
      }
    }
    // Minimizing dependency array to prevent reconnection loops
  }, [gameCode, address])//here

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
          className="w-full md:w-3/4 flex flex-col gap-2 md:gap-4 bg-white/15 rounded-2xl md:rounded-3xl p-2 md:p-4 border border-white/20 shadow-lg overflow-hidden"
        >
          <div className="flex-1 relative">
            {/* <DrawingCanvas socket={socket} /> */}
            {socket && <DrawingCanvas socket={socket} />}
          </div>
          {gameStore.isDrawing && gameStore.roundActive && (
            <div className="h-16 md:h-auto">
              {/* <DrawingTools socket={socket} /> */}
            </div>
          )}
        </motion.div>

        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="w-full md:w-1/4 flex flex-col gap-2 md:gap-4 overflow-hidden"
        >
          {/* Players */}
          <div className="bg-white/15 rounded-2xl md:rounded-3xl p-3 md:p-4 border border-white/20 shadow-lg">
            <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-white flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Players
            </h3>
            <div className="space-y-1 md:space-y-2 max-h-[20vh] md:max-h-[30vh] overflow-y-auto pr-1">
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
        </motion.div>
      </div>
    </div>
  )
}

