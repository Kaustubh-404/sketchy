"use client"

import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { motion } from "framer-motion"
import { ExternalLink, Trophy, Calendar, Hash, Database } from "lucide-react"
import { ArweaveWalletFull } from "@/components/ArweaveWalletFull"
import { getUserGameHistory, getRecentGames } from "@/services/gameStorageService"
import { LoadingSpinner } from "@/components/LoadingSpinner"

interface GameHistoryItem {
  txId: string;
  data: {
    gameCode: string;
    winner: string;
    points: Record<string, number>;
    totalPrize: string;
    timestamp: number;
    players: Array<{
      address: string;
      name: string;
    }>;
  };
}

export default function ArweaveHistory() {
  const [history, setHistory] = useState<GameHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [arweaveWallet, setArweaveWallet] = useState<any>(null)
  const { address } = useAccount()

  const handleArweaveWalletConnect = (wallet: any) => {
    setArweaveWallet(wallet)
  }

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true)
        
        // Try to load history from Arweave if wallet is connected
        if (arweaveWallet && address) {
          const arweaveHistory = await getUserGameHistory(address);
          if (arweaveHistory.length > 0) {
            setHistory(arweaveHistory);
            return;
          }
        }
        
        // Otherwise, fall back to local storage
        const localHistory = JSON.parse(localStorage.getItem('gameHistory') || '[]');
        
        const formattedHistory: GameHistoryItem[] = localHistory.map((game: any) => ({
          txId: '', // No transaction ID for local history
          data: {
            gameCode: game.gameCode,
            winner: game.winner,
            points: {},
            totalPrize: game.prizeAmount.toString(),
            timestamp: game.timestamp,
            players: []
          }
        }));
        
        setHistory(formattedHistory);
      } catch (error) {
        console.error("Error loading history:", error)
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [address, arweaveWallet])

  // Format address for display
  const formatAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1F48B0] to-[#4A0E8F]">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1F48B0] to-[#4A0E8F] py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">Game History</h1>
          <motion.a
            href="/"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-full shadow-md hover:shadow-lg transition-all duration-300 text-sm"
          >
            Back to Games
          </motion.a>
        </div>

        {/* Arweave Wallet Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Database className="mr-2 h-5 w-5" /> 
            Arweave Permanent Storage
          </h2>
          <div className="bg-white/10 rounded-xl p-6 backdrop-blur-sm border border-white/20">
            <p className="text-white/80 mb-4">
              Connect your Arweave wallet to store and retrieve your game history permanently on the permaweb.
            </p>
            <ArweaveWalletFull onWalletConnect={handleArweaveWalletConnect} />
          </div>
        </div>

        {history.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center bg-white/10 backdrop-blur-sm rounded-2xl shadow-xl p-8 mx-4 max-w-md border border-white/20 mx-auto"
          >
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-white">No Games Yet</h2>
            <p className="text-white/80">Start playing to build your history!</p>
            <motion.a
              href="/"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mt-6 inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-full shadow-md hover:shadow-lg transition-all duration-300"
            >
              Play Now
            </motion.a>
          </motion.div>
        ) : (
          <div className="grid gap-6">
            {history.map((game, index) => (
              <motion.div
                key={game.txId || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-white/10 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-white/20"
              >
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Hash className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white/60">Game Code</p>
                        <p className="font-medium text-white">{game.data.gameCode}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 md:justify-end">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <Database className="w-5 h-5 text-green-400" />
                      </div>
                      <div className="md:text-right">
                        <p className="text-sm text-white/60">Storage</p>
                        <p className="font-medium text-white">
                          {game.txId ? 'Arweave' : 'Local Storage'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Trophy className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white/60">Winner</p>
                        <p
                          className={`font-medium ${game.data.winner === address ? "text-purple-400" : "text-white"}`}
                        >
                          {game.data.winner === address ? "You" : formatAddress(game.data.winner)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 md:justify-end">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <Calendar className="w-5 h-5 text-orange-400" />
                      </div>
                      <div className="md:text-right">
                        <p className="text-sm text-white/60">Date</p>
                        <p className="text-white">
                          {new Date(game.data.timestamp).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {game.txId && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <a
                        href={`https://viewblock.io/arweave/tx/${game.txId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View on Arweave Explorer
                        <ExternalLink className="ml-1 w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}






// "use client"

// import { useEffect, useState } from "react"
// import { useScribbleContract } from "@/hooks/useScribbleContract"
// // import { formatEther } from "viem"
// import { LoadingSpinner } from "@/components/LoadingSpinner"
// import { useAccount } from "wagmi"
// import { motion } from "framer-motion"
// import { ExternalLink, Trophy, Calendar, Hash } from "lucide-react"

// interface GameHistoryItem {
//   gameCode: string
//   winner: string
//   prizeAmount: bigint
//   timestamp: number
//   transactionHash?: string
// }

// interface ContractGameHistory {
//   gameCode: string
//   winner: string
//   prizeAmount: bigint
//   timestamp: bigint
//   transactionHash?: string
// }


// export default function History() {
//   const [history, setHistory] = useState<GameHistoryItem[]>([])
//   const [loading, setLoading] = useState(true)
//   const { getGameHistory } = useScribbleContract()
//   const { address } = useAccount()

//   useEffect(() => {
//     const loadHistory = async () => {
//       try {
//         // const gameHistory = await getGameHistory()
//         const contractHistory = await getGameHistory() as ContractGameHistory[]

//         const formattedHistory: GameHistoryItem[] = contractHistory.map(game => ({
//           gameCode: game.gameCode,
//           winner: game.winner,
//           prizeAmount: game.prizeAmount,
//           timestamp: Number(game.timestamp), // Convert bigint to number
//           transactionHash: game.transactionHash
//         }))

//         setHistory(formattedHistory)
//       } catch (error) {
//         console.error("Error loading history:", error)
//       } finally {
//         setLoading(false)
//       }
//     } 

//     if (address) {
//       loadHistory()
//     }
//   }, [address , getGameHistory])

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-950">
//         <LoadingSpinner />
//       </div>
//     )
//   }

//   if (history.length === 0) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-950">
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.5 }}
//           className="text-center bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mx-4 max-w-md border border-gray-100 dark:border-gray-700"
//         >
//           <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-6">
//             <Trophy className="w-10 h-10 text-blue-500 dark:text-blue-300" />
//           </div>
//           <h2 className="text-2xl font-bold mb-4 dark:text-white">No Games Yet</h2>
//           <p className="text-gray-600 dark:text-gray-300">Start playing to build your history!</p>
//           <motion.a
//             href="/"
//             whileHover={{ scale: 1.05 }}
//             whileTap={{ scale: 0.95 }}
//             className="mt-6 inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-full shadow-md hover:shadow-lg transition-all duration-300"
//           >
//             Play Now
//           </motion.a>
//         </motion.div>
//       </div>
//     )
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-950 py-12 px-4">
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.5 }}
//         className="max-w-4xl mx-auto"
//       >
//         <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
//           <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-white">Game History</h1>
//           <motion.a
//             href="/"
//             whileHover={{ scale: 1.05 }}
//             whileTap={{ scale: 0.95 }}
//             className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-full shadow-md hover:shadow-lg transition-all duration-300 text-sm"
//           >
//             Back to Games
//           </motion.a>
//         </div>

//         <div className="grid gap-6">
//           {history.map((game, index) => (
//             <motion.div
//               key={index}
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.3, delay: index * 0.1 }}
//               className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700"
//             >
//               <div className="p-6">
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
//                   <div className="flex items-start space-x-3">
//                     <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
//                       <Hash className="w-5 h-5 text-blue-600 dark:text-blue-400" />
//                     </div>
//                     <div>
//                       <p className="text-sm text-gray-500 dark:text-gray-400">Game Code</p>
//                       <p className="font-medium text-gray-800 dark:text-gray-200">{game.gameCode}</p>
//                     </div>
//                   </div>

//                   <div className="flex items-start space-x-3 md:justify-end">
//                     {/* <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
//                       <Coins className="w-5 h-5 text-green-600 dark:text-green-400" />
//                     </div> */}
//                     {/* <div className="md:text-right">
//                       <p className="text-sm text-gray-500 dark:text-gray-400">Prize</p>
//                       <p className="font-bold text-green-600 dark:text-green-400">
//                         {formatEther(game.prizeAmount)} CORE
//                       </p>
//                     </div> */}
//                   </div>
//                 </div>

//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
//                   <div className="flex items-start space-x-3">
//                     <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
//                       <Trophy className="w-5 h-5 text-purple-600 dark:text-purple-400" />
//                     </div>
//                     <div>
//                       <p className="text-sm text-gray-500 dark:text-gray-400">Winner</p>
//                       <p
//                         className={`font-medium ${game.winner === address ? "text-purple-600 dark:text-purple-400" : "text-gray-800 dark:text-gray-200"}`}
//                       >
//                         {game.winner === address ? "You" : `${game.winner.slice(0, 6)}...${game.winner.slice(-4)}`}
//                       </p>
//                     </div>
//                   </div>

//                   <div className="flex items-start space-x-3 md:justify-end">
//                     <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
//                       <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
//                     </div>
//                     <div className="md:text-right">
//                       <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
//                       <p className="text-gray-700 dark:text-gray-300">
//                         {new Date(game.timestamp * 1000).toLocaleDateString(undefined, {
//                           year: "numeric",
//                           month: "short",
//                           day: "numeric",
//                         })}
//                       </p>
//                     </div>
//                   </div>
//                 </div>

//                 {game.transactionHash && (
//                   <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
//                     <a
//                       href={`https://scan.test.btcs.network/tx/${game.transactionHash}`}
//                       target="_blank"
//                       rel="noopener noreferrer"
//                       className="inline-flex items-center text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors"
//                     >
//                       View Transaction
//                       <ExternalLink className="ml-1 w-3.5 h-3.5" />
//                     </a>
//                   </div>
//                 )}
//               </div>
//             </motion.div>
//           ))}
//         </div>
//       </motion.div>
//     </div>
//   )
// }

