// // src/pages/join.tsx
// import { useState } from 'react';
// import { useRouter } from 'next/router';
// import { useScribbleContract } from '@/hooks/useScribbleContract';
// import { LoadingOverlay } from '@/components/LoadingOverlay';
// import { toast } from 'react-hot-toast';
// import { motion } from 'framer-motion';
// import { Card } from '@/components/ui/card';
// import { Input } from '@/components/ui/input';
// import { Button } from '@/components/ui/button';
// import { formatEther } from 'viem';

// export default function JoinRoom() {
//   const [gameCode, setGameCode] = useState('');
//   const [playerName, setPlayerName] = useState('');
//   const [roomInfo, setRoomInfo] = useState<{
//     wagerAmount: string;
//     maxPlayers: number;
//     currentPlayers: number;
//   } | null>(null);
//   const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  
//   const router = useRouter();
//   const { joinRoom, getRoomDetails, loading } = useScribbleContract();

//   const handleCheckRoom = async () => {
//     if (gameCode.length !== 6) {
//       toast.error('Game code must be 6 characters');
//       return;
//     }

//     try {
//       setIsCheckingRoom(true);
//       const details = await getRoomDetails(gameCode);
      
//       if (!details) {
//         toast.error('Room not found');
//         return;
//       }
      
//       if (!details.isActive) {
//         toast.error('This room is not active');
//         return;
//       }
      
//       if (details.gameEnded) {
//         toast.error('Game has already ended');
//         return;
//       }
      
//       if (details.currentPlayerCount >= details.maxPlayers) {
//         toast.error('Room is full');
//         return;
//       }
      
//       setRoomInfo({
//         wagerAmount: formatEther(details.wagerAmount),
//         maxPlayers: Number(details.maxPlayers),
//         currentPlayers: Number(details.currentPlayerCount)
//       });
      
//       toast.success('Room found! Enter your name to join');
//     } catch (error) {
//       console.error('Error checking room:', error);
//       toast.error('Room not found or no longer active');
//     } finally {
//       setIsCheckingRoom(false);
//     }
//   };

//   const handleJoinRoom = async () => {
//     try {
//       if (!gameCode || !playerName) {
//         toast.error('Please fill in all fields');
//         return;
//       }

//       if (gameCode.length !== 6) {
//         toast.error('Game code must be 6 characters');
//         return;
//       }

//       if (playerName.trim().length < 2) {
//         toast.error('Name must be at least 2 characters');
//         return;
//       }

//       localStorage.setItem('playerName', playerName);
//       await joinRoom(gameCode, playerName);
//       router.push(`/game/${gameCode}`);
//     } catch (error: any) {
//       console.error('Failed to join room:', error);
//     }
//   };

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#1F48B0] relative overflow-hidden">
//       <div 
//         className="absolute inset-0 z-0 opacity-5"
//         style={{
//           backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54 22c0-12-18-8-18 4 0 12-24 8-24-4 0-12 18-8 18 4 0 12 24 8 24-4z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
//           backgroundSize: '60px 60px'
//         }}
//       />
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.5 }}
//         className="w-full max-w-md z-10"
//       >
//         <Card className="bg-white/5 backdrop-blur-sm border-0 shadow-2xl p-8 rounded-3xl">
//           <motion.h2 
//             className="text-2xl font-medium text-center text-white/90 mb-8"
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             transition={{ delay: 0.2 }}
//           >
//             Join Game Room
//           </motion.h2>

//           <div className="space-y-6">
//             <div className="space-y-2">
//               <p className="text-sm font-medium text-white/70 mb-2">Game Code</p>
//               <div className="flex gap-2">
//                 <Input
//                   type="text"
//                   value={gameCode}
//                   onChange={(e) => setGameCode(e.target.value.toUpperCase())}
//                   placeholder="Enter 6-digit code"
//                   maxLength={6}
//                   className="h-12 text-lg tracking-wider text-center bg-white/10 border-0 text-white placeholder-white/30 rounded-xl focus:ring-2 focus:ring-purple-500/50 transition-all"
//                 />
//                 <Button
//                   onClick={handleCheckRoom}
//                   disabled={isCheckingRoom || gameCode.length !== 6}
//                   className="bg-purple-500 hover:bg-purple-600 text-white rounded-xl"
//                 >
//                   {isCheckingRoom ? 'Checking...' : 'Check'}
//                 </Button>
//               </div>
//             </div>

//             {roomInfo && (
//               <motion.div
//                 initial={{ opacity: 0, height: 0 }}
//                 animate={{ opacity: 1, height: 'auto' }}
//                 transition={{ duration: 0.3 }}
//                 className="bg-white/10 rounded-xl p-4 space-y-2"
//               >
//                 <div className="flex justify-between">
//                   <span className="text-white/70">Wager:</span>
//                   <span className="text-white font-medium">{roomInfo.wagerAmount} ETH</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-white/70">Players:</span>
//                   <span className="text-white font-medium">{roomInfo.currentPlayers} / {roomInfo.maxPlayers}</span>
//                 </div>
//                 <p className="text-xs text-white/60 italic mt-2">
//                   You'll need to pay {roomInfo.wagerAmount} ETH to join this game
//                 </p>
//               </motion.div>
//             )}

//             <div className="space-y-2">
//               <p className="text-sm font-medium text-white/70 mb-2">Your Name</p>
//               <Input
//                 type="text"
//                 value={playerName}
//                 onChange={(e) => setPlayerName(e.target.value)}
//                 placeholder="Enter your name"
//                 maxLength={20}
//                 className="h-12 bg-white/10 border-0 text-white placeholder-white/30 rounded-xl focus:ring-2 focus:ring-purple-500/50 transition-all"
//               />
//             </div>

//             <Button
//               onClick={handleJoinRoom}
//               disabled={loading || !roomInfo || !gameCode || !playerName.trim()}
//               className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium text-lg rounded-xl transition-all duration-200 mt-4 border-0 shadow-lg shadow-purple-500/25"
//             >
//               {loading ? 'Joining...' : 'Join Room'}
//             </Button>
//           </div>
//         </Card>
//       </motion.div>
//       {loading && <LoadingOverlay message="Joining room..." />}
//     </div>
//   );
// }

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useScribbleContract } from '@/hooks/useScribbleContract';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatEther } from 'viem';

export default function JoinRoom() {
  const [gameCode, setGameCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomInfo, setRoomInfo] = useState<{
    wagerAmount: string;
    maxPlayers: number;
    currentPlayers: number;
  } | null>(null);
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  
  const router = useRouter();
  const { joinRoom, getRoomDetails, loading } = useScribbleContract();

  const handleCheckRoom = async () => {
    if (gameCode.length !== 6) {
      toast.error('Game code must be 6 characters');
      return;
    }

    try {
      setIsCheckingRoom(true);
      const details = await getRoomDetails(gameCode);
      
      if (!details) {
        toast.error('Room not found');
        return;
      }
      
      if (!details.isActive) {
        toast.error('This room is not active');
        return;
      }
      
      if (details.gameEnded) {
        toast.error('Game has already ended');
        return;
      }
      
      if (details.currentPlayerCount >= details.maxPlayers) {
        toast.error('Room is full');
        return;
      }
      
      setRoomInfo({
        wagerAmount: formatEther(details.wagerAmount),
        maxPlayers: Number(details.maxPlayers),
        currentPlayers: Number(details.currentPlayerCount)
      });
      
      toast.success('Room found! Enter your name to join');
    } catch (error) {
      console.error('Error checking room:', error);
      toast.error('Room not found or no longer active');
    } finally {
      setIsCheckingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    try {
      if (!gameCode || !playerName) {
        toast.error('Please fill in all fields');
        return;
      }

      if (gameCode.length !== 6) {
        toast.error('Game code must be 6 characters');
        return;
      }

      if (playerName.trim().length < 2) {
        toast.error('Name must be at least 2 characters');
        return;
      }

      localStorage.setItem('playerName', playerName);
      await joinRoom(gameCode, playerName);
      router.push(`/game/${gameCode}`);
    } catch (error: unknown) {
      console.error('Failed to join room:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#1F48B0] relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <Card className="bg-white/10 border border-white/20 shadow-xl p-8 rounded-2xl w-full max-w-lg">
          <motion.h2 
            className="text-2xl font-semibold text-center text-white mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Join Game Room
          </motion.h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-white mb-2">Game Code</p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="h-12 text-lg tracking-wider text-center bg-white/20 border border-white/30 text-white placeholder-white/50 rounded-lg focus:ring-2 focus:ring-purple-500/50 transition-all"
                />
                <Button
                  onClick={handleCheckRoom}
                  disabled={isCheckingRoom || gameCode.length !== 6}
                  className="h-12 bg-purple-500 hover:bg-purple-600 text-white rounded-lg px-6 flex items-center justify-center"
                >
                  {isCheckingRoom ? 'Checking...' : 'Check'}
                </Button>
              </div>
            </div>

            {roomInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
                className="bg-white/10 rounded-lg p-4 space-y-2 border border-white/20"
              >
                <div className="flex justify-between">
                  <span className="text-white/70">Wager:</span>
                  <span className="text-white font-medium">{roomInfo.wagerAmount} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Players:</span>
                  <span className="text-white font-medium">{roomInfo.currentPlayers} / {roomInfo.maxPlayers}</span>
                </div>
              </motion.div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-white mb-2">Your Name</p>
              <Input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                className="h-12 bg-white/20 border border-white/30 text-white placeholder-white/50 rounded-lg focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
            </div>

            <Button
              onClick={handleJoinRoom}
              disabled={loading || !roomInfo || !gameCode || !playerName.trim()}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold text-lg rounded-lg transition-all duration-200 border-0 shadow-lg"
            >
              {loading ? 'Joining...' : 'Join Room'}
            </Button>
          </div>
        </Card>
      </motion.div>
      {loading && <LoadingOverlay message="Joining room..." />}
    </div>
  );
}