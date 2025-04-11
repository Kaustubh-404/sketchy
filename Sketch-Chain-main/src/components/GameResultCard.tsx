

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Pencil, Loader2, ExternalLink, Copy } from 'lucide-react';
import { formatEther } from 'viem';

interface GameResultProps {
  isWinner: boolean;
  prize?: bigint | string;
  playerAddress: string;
  transactionConfirmed?: boolean;
  transactionHash?: string;
  winner?: string;
  onClose?: () => void;
}

const GameResultCard: React.FC<GameResultProps> = ({ 
  isWinner, 
  prize, 
  transactionConfirmed = false,
  transactionHash = '',
  winner = '',
  onClose
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Format the prize correctly regardless of type
  let formattedPrize = '0';
  
  try {
    if (prize) {
      if (typeof prize === 'bigint') {
        formattedPrize = formatEther(prize);
      } else if (typeof prize === 'string') {
        formattedPrize = formatEther(BigInt(prize));
      }
    }
  } catch (error) {
    console.error('Error formatting prize:', error);
    formattedPrize = '0';
  }
  
  // Format the address for display
  const formatAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Format the transaction hash for display
  const formatTxHash = (hash: string) => {
    if (!hash || hash.length < 10) return hash;
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
  };

  // Handle clicking the "Okay" button
  const handleOkayClick = () => {
    if (onClose) {
      onClose();
    }
  };

  // Handle copying the transaction hash
  const copyTxHash = () => {
    if (transactionHash) {
      navigator.clipboard.writeText(transactionHash)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        })
        .catch(err => console.error('Failed to copy:', err));
    }
  };

  // Handle visiting the transaction explorer
  const visitExplorer = () => {
    if (transactionHash) {
      const explorerUrl = `https://testnet.scan.coredao.org/tx/${transactionHash}`;
      window.open(explorerUrl, '_blank');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        className={`w-full max-w-md p-8 rounded-2xl shadow-2xl ${
          isWinner 
            ? 'bg-gradient-to-br from-yellow-100 to-yellow-50 border-2 border-yellow-200' 
            : 'bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-blue-200'
        }`}
      >
        <div className="text-center space-y-6">
          {isWinner ? (
            <>
              <motion.div
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", duration: 1.5 }}
                className="inline-block"
              >
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
              </motion.div>
              <motion.h2 
                className="text-4xl font-bold text-yellow-800"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                🎉 Victory! 🎉
              </motion.h2>
              <p className="text-yellow-700 text-lg">Congratulations, you&apos;ve won!</p>
              <div className="bg-yellow-200/50 rounded-lg p-4 mt-4">
                <p className="text-yellow-800 font-semibold">Prize Won</p>
                <p className="text-2xl font-bold text-yellow-900">{formattedPrize} CORE</p>
                
                {!transactionConfirmed && (
                  <div className="flex items-center justify-center mt-2 text-yellow-700">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Transferring funds to your wallet...</span>
                  </div>
                )}
                {transactionConfirmed && transactionHash && (
                  <div className="mt-3">
                    <div className="text-green-600 font-medium">
                      ✓ Funds transferred successfully!
                    </div>
                    <div className="mt-2 text-sm text-yellow-800">
                      <p className="mb-1">Transaction Hash:</p>
                      <div className="flex items-center justify-center">
                        <div className="bg-yellow-300/30 px-3 py-1 rounded-lg flex items-center space-x-2">
                          <span className="font-mono">{formatTxHash(transactionHash)}</span>
                          <button 
                            onClick={copyTxHash}
                            className="hover:text-yellow-600 transition-colors"
                            title="Copy to clipboard"
                          >
                            <Copy size={14} />
                          </button>
                          <button 
                            onClick={visitExplorer}
                            className="hover:text-yellow-600 transition-colors"
                            title="View on explorer"
                          >
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      </div>
                      {copySuccess && (
                        <div className="text-xs text-green-600 mt-1">
                          Copied to clipboard!
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <motion.div
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                transition={{ type: "spring", duration: 1 }}
                className="inline-block"
              >
                <Pencil className="w-16 h-16 text-blue-500 mx-auto" />
              </motion.div>
              <h2 className="text-4xl font-bold text-blue-800">Keep Drawing!</h2>
              <p className="text-blue-700 text-lg">Better luck next time! 🎨</p>
              
              {/* Winner info and prize for losers */}
              <div className="bg-blue-200/50 rounded-lg p-4 mt-4">
                <p className="text-blue-700 font-medium">Game Results</p>
                <div className="flex items-center justify-center mt-1 mb-2">
                  <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
                  <span className="text-blue-800 font-semibold">
                    Winner: {formatAddress(winner)}
                  </span>
                </div>
                <p className="text-blue-800">
                  Prize amount: <span className="font-semibold">{formattedPrize} CORE</span>
                </p>
              </div>
              
              <p className="text-blue-600 italic mt-2">
                &quot;Practice makes perfect - every game makes you better!&quot;
              </p>
            </>
          )}
          
          {/* "Okay" button for everyone */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOkayClick}
            className={`mt-6 py-3 px-8 rounded-full font-semibold text-white shadow-md ${
              isWinner 
                ? (transactionConfirmed ? 'bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-600 hover:to-yellow-500' : 'bg-gray-400 cursor-not-allowed')
                : 'bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500'
            }`}
            disabled={isWinner && !transactionConfirmed}
          >
            Okay
          </motion.button>
          
          {isWinner && !transactionConfirmed && (
            <div className="mt-6 text-gray-500">
              <p className="text-sm">Please wait while we transfer your prize...</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default GameResultCard;