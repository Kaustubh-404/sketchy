import { useState, useEffect } from 'react';
import { 
  generateWallet, 
  getWalletAddress, 
  getWalletBalance 
} from '@/services/arweaveService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Wallet, ArrowRightLeft, ChevronDown, Download, Upload, Check, X } from 'lucide-react';

interface ArweaveWalletProps {
  onWalletConnect: (wallet: any) => void;
  required?: boolean;
}

export const ArweaveWalletFull: React.FC<ArweaveWalletProps> = ({ onWalletConnect, required = true }) => {
  const [wallet, setWallet] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [importedKey, setImportedKey] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [balanceSufficient, setBalanceSufficient] = useState<boolean>(false);
  
  // Minimum balance required for game transactions in AR
  const MIN_BALANCE_REQUIRED = 0.01;

  // Check local storage for saved wallet
  useEffect(() => {
    const savedWallet = localStorage.getItem('arweaveWallet');
    if (savedWallet) {
      try {
        const parsedWallet = JSON.parse(savedWallet);
        setWallet(parsedWallet);
        loadWalletDetails(parsedWallet);
        onWalletConnect(parsedWallet);
      } catch (error) {
        console.error('Error loading saved wallet:', error);
        localStorage.removeItem('arweaveWallet');
      }
    } else if (required) {
      toast.error('An Arweave wallet is required to play this game');
    }
  }, [onWalletConnect, required]);

  // Effect to periodically update balance
  useEffect(() => {
    if (!wallet) return;
    
    const updateBalance = async () => {
      try {
        const balanceAR = await getWalletBalance(walletAddress);
        setBalance(balanceAR);
        
        // Check if balance is sufficient for gameplay
        setBalanceSufficient(parseFloat(balanceAR) >= MIN_BALANCE_REQUIRED);
      } catch (error) {
        console.error('Error updating balance:', error);
      }
    };
    
    updateBalance();
    const interval = setInterval(updateBalance, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [wallet, walletAddress]);

  const loadWalletDetails = async (walletObj: any) => {
    try {
      const address = await getWalletAddress(walletObj);
      setWalletAddress(address);
      
      const balanceAR = await getWalletBalance(address);
      setBalance(balanceAR);
      
      // Check if balance is sufficient for gameplay
      setBalanceSufficient(parseFloat(balanceAR) >= MIN_BALANCE_REQUIRED);
    } catch (error) {
      console.error('Error loading wallet details:', error);
      toast.error('Failed to load wallet details');
    }
  };

  const handleCreateWallet = async () => {
    setIsLoading(true);
    try {
      const newWallet = await generateWallet();
      setWallet(newWallet);
      
      // Save to local storage
      localStorage.setItem('arweaveWallet', JSON.stringify(newWallet));
      
      // Load wallet details
      await loadWalletDetails(newWallet);
      
      // Pass wallet to parent component
      onWalletConnect(newWallet);
      
      toast.success('Arweave wallet created successfully!');
      
      // Since this is a new wallet, prompt to get AR tokens
      toast.custom(
        <div className="bg-yellow-500 text-white px-6 py-4 rounded-lg shadow-lg">
          <p className="font-medium">Your new wallet needs AR tokens!</p>
          <p className="text-sm mt-1">Visit the Arweave faucet to get free tokens.</p>
          <div className="mt-2 flex justify-end">
            <a 
              href="https://faucet.arweave.net/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-white text-yellow-500 px-4 py-1 rounded font-medium text-sm hover:bg-yellow-100 transition-colors"
            >
              Visit Faucet
            </a>
          </div>
        </div>,
        { duration: 10000 }
      );
    } catch (error) {
      console.error('Error creating wallet:', error);
      toast.error('Failed to create Arweave wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportWallet = async () => {
    if (!importedKey) {
      toast.error('Please enter a valid wallet key');
      return;
    }
    
    setIsLoading(true);
    try {
      // Parse the imported key
      const importedWallet = JSON.parse(importedKey);
      
      // Validate the wallet
      await getWalletAddress(importedWallet);
      
      setWallet(importedWallet);
      
      // Save to local storage
      localStorage.setItem('arweaveWallet', JSON.stringify(importedWallet));
      
      // Load wallet details
      await loadWalletDetails(importedWallet);
      
      // Pass wallet to parent component
      onWalletConnect(importedWallet);
      
      // Clear the import field
      setImportedKey('');
      
      toast.success('Arweave wallet imported successfully!');
    } catch (error) {
      console.error('Error importing wallet:', error);
      toast.error('Invalid wallet key format');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (required) {
      toast.error('An Arweave wallet is required to play this game');
      return;
    }
    
    localStorage.removeItem('arweaveWallet');
    setWallet(null);
    setWalletAddress('');
    setBalance('0');
    onWalletConnect(null);
    toast.success('Wallet disconnected');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const contents = event.target?.result as string;
        setImportedKey(contents);
      } catch (error) {
        console.error('Error reading file:', error);
        toast.error('Invalid wallet file');
      }
    };
    reader.readAsText(file);
  };

  const exportWallet = () => {
    if (!wallet) return;
    
    const dataStr = JSON.stringify(wallet, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportName = `arweave-wallet-${walletAddress.substring(0, 8)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
    
    toast.success('Wallet exported successfully');
  };

  return (
    <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <Wallet className="mr-2 h-5 w-5" /> 
          Arweave Wallet
        </h2>
        {wallet && (
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-white/60 hover:text-white/80 transition-colors"
          >
            <ChevronDown className={`h-5 w-5 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      
      {wallet ? (
        <div className="space-y-3">
          <div className="bg-white/5 p-3 rounded-lg">
            <p className="text-sm text-gray-300">Address</p>
            <div className="flex items-center">
              <p className="text-white font-mono text-sm truncate">{walletAddress}</p>
              <button 
                onClick={() => navigator.clipboard.writeText(walletAddress).then(() => toast.success('Address copied!'))}
                className="ml-2 text-white/60 hover:text-white/90 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="bg-white/5 p-3 rounded-lg">
            <p className="text-sm text-gray-300">Balance</p>
            <div className="flex justify-between items-center">
              <p className="text-white font-semibold">{balance} AR</p>
              {balanceSufficient ? (
                <span className="inline-flex items-center text-xs text-green-400">
                  <Check className="w-3 h-3 mr-1" /> Sufficient
                </span>
              ) : (
                <span className="inline-flex items-center text-xs text-red-400">
                  <X className="w-3 h-3 mr-1" /> Low balance
                </span>
              )}
            </div>
          </div>
          
          {!balanceSufficient && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-yellow-500/20 p-3 rounded-lg"
            >
              <p className="text-yellow-300 text-sm">
                Your balance is too low for gameplay. Get AR tokens from the{' '}
                <a 
                  href="https://faucet.arweave.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-yellow-200"
                >
                  Arweave Faucet
                </a>
              </p>
            </motion.div>
          )}
          
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3 pt-2"
            >
              <div className="flex space-x-2">
                <Button
                  onClick={exportWallet}
                  className="flex-1 bg-blue-500/70 hover:bg-blue-500/90 text-white"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
                
                {!required && (
                  <Button
                    onClick={handleDisconnect}
                    variant="destructive"
                    className="flex-1"
                    size="sm"
                  >
                    Disconnect
                  </Button>
                )}
              </div>
              
              <div className="text-xs text-white/60 text-center">
                <p>Make sure to backup your wallet! You can't recover funds without your key file.</p>
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Button
            onClick={handleCreateWallet}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create New Wallet'}
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-[#1F48B0] text-white/60">or</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-white/70">Import from Key File</label>
            <Input
              type="file"
              onChange={handleFileUpload}
              accept=".json"
              className="w-full bg-white/10 border-white/20 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-white/70">Paste Wallet Key (JSON)</label>
            <textarea
              value={importedKey}
              onChange={(e) => setImportedKey(e.target.value)}
              placeholder='{"kty":"RSA", ...}'
              className="w-full h-24 p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 text-sm"
            />
          </div>
          
          <Button
            onClick={handleImportWallet}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
            disabled={isLoading || !importedKey}
          >
            {isLoading ? 'Importing...' : 'Import Wallet'}
          </Button>
        </div>
      )}
    </div>
  );
};