import { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { formatTxId, getExplorerUrl } from '@/utils/arweaveUtils';
import { motion } from 'framer-motion';

interface ArweaveStatusProps {
  txId: string;
  type?: 'drawing' | 'gameState' | 'gameResult' | 'chatHistory';
  onConfirmed?: () => void;
}

export const ArweaveStatus: React.FC<ArweaveStatusProps> = ({ 
  txId, 
  type = 'gameState',
  onConfirmed
}) => {
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'failed'>('pending');
  const [confirmations, setConfirmations] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!txId) return;

    // Set up polling for transaction status
    const checkStatus = async () => {
      try {
        const response = await fetch(`https://arweave.net/tx/${txId}/status`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          if (data.status === 200 && data.confirmed) {
            setStatus('confirmed');
            setConfirmations(data.confirmed.number_of_confirmations || 1);
            if (onConfirmed) onConfirmed();
          } else if (data.status === 202) {
            setStatus('pending');
          } else {
            setStatus('failed');
            setError('Transaction failed or not found');
          }
        } else if (response.status === 202) {
          // Transaction is pending
          setStatus('pending');
        } else {
          setStatus('failed');
          setError(`Error checking status: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error checking transaction status:', error);
        setStatus('failed');
        setError('Network error checking transaction status');
      }
    };

    // Check immediately
    checkStatus();
    
    // Set up polling interval
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [txId, onConfirmed]);

  // Define type-specific labels
  const typeLabels = {
    drawing: 'Drawing',
    gameState: 'Game State',
    gameResult: 'Game Result',
    chatHistory: 'Chat History'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20"
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-medium text-white/80 mb-1">
            {typeLabels[type]} - Arweave Transaction
          </h4>
          <div className="flex items-center">
            <span className="text-xs font-mono text-white/60 mr-2">
              {formatTxId(txId)}
            </span>
            <a 
              href={getExplorerUrl(txId)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          {status === 'pending' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300">
              <Clock size={12} className="mr-1" /> 
              Pending
            </span>
          )}
          
          {status === 'confirmed' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300">
              <CheckCircle size={12} className="mr-1" /> 
              Confirmed{confirmations > 0 ? ` (${confirmations})` : ''}
            </span>
          )}
          
          {status === 'failed' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300">
              <AlertCircle size={12} className="mr-1" /> 
              Failed
            </span>
          )}
        </div>
      </div>
      
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
      
      {status === 'confirmed' && (
        <p className="mt-2 text-xs text-green-400">
          Your data is now permanently stored on the Arweave network!
        </p>
      )}
      
      {status === 'pending' && (
        <p className="mt-2 text-xs text-yellow-400">
          Your data is being processed by the Arweave network. This may take a few minutes.
        </p>
      )}
    </motion.div>
  );
};