import { useState } from 'react';
import { useRouter } from 'next/router';
import { useScribbleContract } from '@/hooks/useScribbleContract';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function CreateRoom() {
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [wagerAmount, setWagerAmount] = useState('1');
  const [playerName, setPlayerName] = useState('');
  const router = useRouter();
  const { createRoom, loading } = useScribbleContract();

  const handleCreateRoom = async () => {
    try {
      if (!playerName.trim()) {
        toast.error('Please enter your name');
        return;
      }
      
      const gameCode = await createRoom(maxPlayers, wagerAmount, playerName);
      router.push(`/game/${gameCode}`);
    } catch (error) {
      console.log(error)
      // Error handling is done in the hook
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg md:max-w-xl lg:max-w-2xl"
      >
        <div className="bg-white/20 backdrop-blur-none rounded-3xl p-6 sm:p-8 border border-white/30 shadow-lg w-full">
          <h1 className="text-2xl font-bold mb-6 text-white text-center">Create Game Room</h1>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/80">Your Name</label>
              <Input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                className="h-12 bg-white/10 border-0 text-white placeholder-white/30 rounded-xl focus:ring-2 focus:ring-green-500/50 transition-all w-full"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/80">
                Number of Players: <span className="font-bold">{maxPlayers}</span>
              </label>
              <div className="px-2">
                <input
                  type="range"
                  min="2"
                  max="8"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-white/60 mt-1">
                  <span>2</span>
                  <span>8</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/80">Wager Amount (ETH)</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={wagerAmount}
                onChange={(e) => setWagerAmount(e.target.value)}
                className="h-12 bg-white/10 border-0 text-white placeholder-white/30 rounded-xl focus:ring-2 focus:ring-green-500/50 transition-all w-full"
              />
              <p className="text-xs text-white/60 italic">
                Each player will contribute this amount to join the game. The total prize will be 
                {maxPlayers > 0 ? ` ${(parseFloat(wagerAmount) * maxPlayers).toFixed(2)} ETH` : ''}
              </p>
            </div>

            <Button
              onClick={handleCreateRoom}
              disabled={loading || !playerName.trim() || maxPlayers < 2 || parseFloat(wagerAmount) <= 0}
              className="w-full h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-green-500/25"
            >
              {loading ? 'Creating...' : 'Create Game Room'}
            </Button>
          </div>
        </div>
      </motion.div>
      {loading && <LoadingOverlay message="Creating room..." />}
    </div>
  );
}