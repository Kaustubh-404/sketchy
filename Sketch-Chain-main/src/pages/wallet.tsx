import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { ArweaveWalletFull } from '@/components/ArweaveWalletFull';
import { Wallet, Info, AlertCircle, Check } from 'lucide-react';
import { ARWEAVE_FAUCET_URL } from '@/config/arweave';
import { Button } from '@/components/ui/button';

export default function WalletPage() {
  const [arweaveWallet, setArweaveWallet] = useState<any>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const router = useRouter();

  // Check for redirect query parameter
  useEffect(() => {
    if (router.query.redirect) {
      setRedirectTo(router.query.redirect as string);
    }
  }, [router.query]);

  // Detect if wallet already exists
  useEffect(() => {
    const savedWallet = localStorage.getItem('arweaveWallet');
    if (savedWallet) {
      try {
        const parsedWallet = JSON.parse(savedWallet);
        setArweaveWallet(parsedWallet);
      } catch (error) {
        console.error('Error loading saved wallet:', error);
        localStorage.removeItem('arweaveWallet');
      }
    }
  }, []);

  // Handle wallet connection
  const handleWalletConnect = (wallet: any) => {
    setArweaveWallet(wallet);
    
    // Redirect if we have a redirect destination
    if (wallet && redirectTo) {
      router.push(redirectTo);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1F48B0] to-[#4A0E8F] py-16 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="inline-block bg-white/10 p-4 rounded-full mb-4"
          >
            <Wallet className="w-12 h-12 text-white" />
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Arweave Wallet Required</h1>
          <p className="text-white/80 text-lg max-w-xl mx-auto">
            Sketchy now runs entirely on Arweave, which requires an Arweave wallet
            and AR tokens to play.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl p-6 mb-8">
          <ArweaveWalletFull onWalletConnect={handleWalletConnect} required={true} />
        </div>

        {/* Informational cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5"
          >
            <div className="flex items-start">
              <div className="bg-blue-500/20 p-2 rounded-lg mr-4">
                <Info className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-2">Why Arweave?</h3>
                <p className="text-white/70 text-sm">
                  Arweave provides permanent storage and decentralized smart contracts,
                  enabling Sketchy to run entirely on the permaweb with no central servers.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5"
          >
            <div className="flex items-start">
              <div className="bg-yellow-500/20 p-2 rounded-lg mr-4">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-2">Need AR Tokens?</h3>
                <p className="text-white/70 text-sm mb-3">
                  You'll need AR tokens to play Sketchy. Get free AR tokens from the
                  Arweave faucet for testing.
                </p>
                <a 
                  href={ARWEAVE_FAUCET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded-full hover:bg-yellow-500/30 transition-colors"
                >
                  Visit Arweave Faucet
                </a>
              </div>
            </div>
          </motion.div>
        </div>

        {arweaveWallet && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <div className="inline-flex items-center justify-center bg-green-500/20 text-green-400 px-4 py-2 rounded-full mb-4">
              <Check className="w-5 h-5 mr-2" /> 
              Wallet Connected
            </div>
            
            <div className="flex justify-center space-x-4">
              <Button 
                onClick={() => router.push('/')}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                Go to Home
              </Button>
              
              {redirectTo && (
                <Button 
                  onClick={() => router.push(redirectTo)}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  Continue
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}