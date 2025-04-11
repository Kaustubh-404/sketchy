import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { GameRoomArweave } from '@/components/GameRoomArweave';
import { useGameStore } from '@/store/gameStore';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { toast } from 'react-hot-toast';

export default function GamePage() {
  const router = useRouter();
  const { gameCode } = router.query;
  const { reset } = useGameStore();
  const [arweaveWallet, setArweaveWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Check for Arweave wallet
  useEffect(() => {
    const checkWallet = () => {
      const savedWallet = localStorage.getItem('arweaveWallet');
      if (savedWallet) {
        try {
          const parsedWallet = JSON.parse(savedWallet);
          setArweaveWallet(parsedWallet);
          setLoading(false);
        } catch (error) {
          console.error('Error loading saved wallet:', error);
          localStorage.removeItem('arweaveWallet');
          redirectToWallet();
        }
      } else {
        redirectToWallet();
      }
    };

    const redirectToWallet = () => {
      // Redirect to wallet page with redirect back to this page
      const currentPath = router.asPath;
      router.push(`/wallet?redirect=${encodeURIComponent(currentPath)}`);
    };

    if (gameCode) {
      checkWallet();
    }
  }, [gameCode, router]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Reset game state when navigating away
      reset();
    };
  }, [reset]);

  if (loading || !arweaveWallet) {
    return <LoadingOverlay message="Checking wallet..." />;
  }

  if (!gameCode) {
    return <LoadingOverlay message="Loading game..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1F48B0] to-[#4A0E8F]">
      <GameRoomArweave gameCode={gameCode as string} wallet={arweaveWallet} />
    </div>
  );
}





// import { useEffect } from 'react';
// import { useRouter } from 'next/router';
// import { useAccount } from 'wagmi';
// import { GameRoom } from '@/components/GameRoom';
// import { useGameStore } from '@/store/gameStore';
// import { io } from 'socket.io-client';
// import { toast } from 'react-hot-toast';

// export default function GamePage() {
//   const router = useRouter();
//   const { gameCode } = router.query;
//   const { address } = useAccount();
//   const { reset } = useGameStore();

//   useEffect(() => {
//     if (!gameCode || !address) return;

//     const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
//       query: { gameCode, address },
//     });

//     // socket.on('gameState', (state) => {
//     //   // Update game state
//     // });

//     socket.on('gameEnd', async (data) => {

//       const resultCardElement = document.getElementById('game-result-root');
//   if (!resultCardElement) {
//     if (data.winner === address) {
//       toast.success('🎉 Congratulations! You won!');
//     } else {
//       toast.error('Game Over! Better luck next time!');
//     }
//     reset();
//     router.push('/');
//   }
//     });

//     return () => {
//       socket.disconnect();
//     };
//   }, [gameCode, address, reset, router]);

//   if (!gameCode || !address) return null;

//   return <GameRoom />;
// }


