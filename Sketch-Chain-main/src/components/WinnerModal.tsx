// src/components/WinnerModal.tsx
import { formatEther } from 'viem';

interface WinnerModalProps {
  winner: string;
  prize: bigint;
  transactionHash?: string;
  onClose: () => void;
}

export const WinnerModal = ({ winner, prize, transactionHash, onClose }: WinnerModalProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold text-center mb-4">🎉 Game Over! 🎉</h2>
        <div className="space-y-4">
          <p className="text-center">
            Winner: {winner.slice(0, 6)}...{winner.slice(-4)}
          </p>
          <p className="text-center text-xl font-bold">
            Prize: {formatEther(prize)} ETH
          </p>
          {transactionHash && (
            <div className="text-center text-sm">
              <p className="text-gray-600">Transaction Hash:</p>
              <a 
                href={`https://explorer.testnet.mantle.xyz/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 break-all"
              >
                {transactionHash}
              </a>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Close
        </button>
      </div>
    </div>
  );
};