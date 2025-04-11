

import { useAccount } from 'wagmi';
import { useRouter } from 'next/router';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { PlusCircle, Users, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";

const ColorfulAvatar = ({ color, delay }: { color: string; delay: number }) => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ delay, type: "spring", stiffness: 260, damping: 20 }}
    className={`w-12 h-12 rounded-full ${color} flex items-center justify-center`}
  >
    <div className="w-8 h-8 rounded-full bg-white/20" />
  </motion.div>
);

const FloatingElement = ({ children, x, y, delay }: { children: React.ReactNode; x: number; y: number; delay: number }) => (
  <motion.div
    className="absolute"
    initial={{ opacity: 0, x, y }}
    animate={{ opacity: 1, x: [x - 20, x + 20, x], y: [y - 20, y + 20, y] }}
    transition={{
      opacity: { delay, duration: 0.5 },
      x: { delay, duration: 5, repeat: Infinity, repeatType: 'reverse' },
      y: { delay, duration: 5, repeat: Infinity, repeatType: 'reverse' },
    }}
  >
    {children}
  </motion.div>
);

const AmongUsMinion = ({ color, x, y, delay }: { color: string; x: number; y: number; delay: number }) => (
  <FloatingElement x={x} y={y} delay={delay}>
    <motion.div
      className={`w-12 h-16 ${color} rounded-t-full relative`}
      animate={{ rotateY: [0, 180, 0] }}
      transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
    >
      <div className="absolute top-1/4 left-1/4 w-6 h-4 bg-[#C6E3FF] rounded-full" />
      <div className="absolute bottom-0 left-0 w-full h-1/3 bg-[#7C9DB5] rounded-b-lg" />
    </motion.div>
  </FloatingElement>
);

const Scribble = ({ x, y, delay }: { x: number; y: number; delay: number }) => (
  <FloatingElement x={x} y={y} delay={delay}>
    <motion.svg
      width="50"
      height="50"
      viewBox="0 0 50 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ rotate: 360 }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    >
      <path d="M25 5C15 15 35 25 25 35C15 45 5 35 15 25C25 15 35 5 25 15C15 25 5 15 15 5C25 -5 35 -5 25 5Z" stroke="white" strokeWidth="2" />
    </motion.svg>
  </FloatingElement>
);

export default function Home() {
  const { address } = useAccount();
  const router = useRouter();

  const buttonVariants = {
    initial: { scale: 1 },
    hover: { 
      scale: 1.05,
      transition: {
        duration: 0.2,
        ease: "easeInOut"
      }
    },
    tap: { 
      scale: 0.95,
      transition: {
        duration: 0.1,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center relative overflow-hidden">
      <AmongUsMinion color="bg-red-500" x={-100} y={-150} delay={0.5} />
      <AmongUsMinion color="bg-blue-500" x={100} y={-100} delay={0.7} />
      <AmongUsMinion color="bg-green-500" x={-150} y={100} delay={0.9} />
      <Scribble x={150} y={150} delay={1.1} />
      <Scribble x={-120} y={-80} delay={1.3} />
      <Scribble x={80} y={120} delay={1.5} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-2xl mx-auto px-4"
      >
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20">
          <motion.div
            className="flex flex-col items-center justify-center gap-4 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div
              animate={{
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Pencil className="w-12 h-12 text-white" />
            </motion.div>
            <h1 className="text-5xl sm:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF4B4B] via-[#FFEB3B] to-[#4CAF50]">
              SKETCHY
            </h1>
            
            <div className="flex gap-2 mt-2">
              {['bg-[#FF4B4B]', 'bg-[#FF9800]', 'bg-[#FFEB3B]', 'bg-[#4CAF50]', 'bg-[#2196F3]', 'bg-[#9C27B0]'].map((color, i) => (
                <ColorfulAvatar key={color} color={color} delay={0.1 + i * 0.1} />
              ))}
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-white/90 text-lg sm:text-xl text-center mb-8"
          >
            Draw, Guess, and Earn with Web3 - Let your creativity flow!
          </motion.p>

          <AnimatePresence>
            {!address ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: 0.6 }}
                className="flex justify-center"
              >
                <ConnectButton />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="grid gap-4 sm:grid-cols-2"
              >
                <motion.div
                  variants={buttonVariants}
                  initial="initial"
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button
                    onClick={() => router.push('/create')}
                    className="w-full h-16 flex items-center justify-center gap-3 bg-[#4CAF50] hover:bg-[#45a049] text-white rounded-2xl shadow-lg group text-xl"
                  >
                    <PlusCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold">Play!</span>
                  </Button>
                </motion.div>

                <motion.div
                  variants={buttonVariants}
                  initial="initial"
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button
                    onClick={() => router.push('/join')}
                    className="w-full h-16 flex items-center justify-center gap-3 bg-[#2196F3] hover:bg-[#1e88e5] text-white rounded-2xl shadow-lg group text-xl"
                  >
                    <Users className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold">Join Private Room</span>
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

