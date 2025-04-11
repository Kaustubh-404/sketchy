import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ClientOnly } from './ClientOnly';
import { Palette, History, Home, Pencil, Eraser, PaintBucket} from 'lucide-react';
import { motion } from 'framer-motion';


interface LayoutProps {
  children: ReactNode;
}

const FloatingIcon = ({ Icon, x, y, delay }: { Icon: typeof Pencil; x: number; y: number; delay: number }) => (
  <motion.div
    className="absolute z-0 opacity-0 sm:opacity-100"
    initial={{ opacity: 0, x, y, rotate: 0 }}
    animate={{ 
      opacity: [0, 0.6, 0.4], 
      x: [x - 20, x + 20, x], 
      y: [y - 20, y + 20, y],
      rotate: 360
    }}
    transition={{
      opacity: { delay, duration: 0.5 },
      x: { delay, duration: 5, repeat: Infinity, repeatType: 'reverse' },
      y: { delay, duration: 5, repeat: Infinity, repeatType: 'reverse' },
      rotate: { delay, duration: 10, repeat: Infinity, ease: "linear" }
    }}
  >
    <Icon className="w-6 h-6 md:w-8 md:h-8 text-white/60 filter drop-shadow-lg" />
  </motion.div>
);

const Scribble = ({ x, y, delay }: { x: number; y: number; delay: number }) => (
  <motion.div
    className="absolute z-0 hidden sm:block"
    initial={{ opacity: 0, x, y, scale: 0 }}
    animate={{ 
      opacity: [0, 0.6, 0.4], 
      x: [x - 30, x + 30, x], 
      y: [y - 30, y + 30, y],
      scale: [0.8, 1.2, 0.8],
    }}
    transition={{
      opacity: { delay, duration: 0.5 },
      x: { delay, duration: 7, repeat: Infinity, repeatType: 'reverse' },
      y: { delay, duration: 8, repeat: Infinity, repeatType: 'reverse' },
      scale: { delay, duration: 6, repeat: Infinity, repeatType: 'reverse' },
    }}
  >
    <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" className="filter drop-shadow-md">
      <path d="M30 10C20 25 40 35 30 50C20 35 40 25 30 10Z" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  </motion.div>
);

const CursorTrail = () => {
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDesktop) {
        setTrail((prevTrail) => [...prevTrail.slice(-12), { x: e.clientX, y: e.clientY }]);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', checkScreenSize);
    };
  }, [isDesktop]);

  return (
    <>
      {isDesktop && trail.map((point, index) => (
        <motion.div
          key={index}
          className="fixed w-2 h-2 rounded-full bg-white/60 filter blur-[1px] pointer-events-none z-50"
          style={{ left: point.x, top: point.y }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      ))}
    </>
  );
};

const ColorfulAvatar = ({ color, delay }: { color: string; delay: number }) => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ delay, type: "spring", stiffness: 260, damping: 20 }}
    className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full ${color} flex items-center justify-center shadow-lg`}
    whileHover={{ scale: 1.2, rotate: 15 }}
  >
    <div className="w-3 h-3 sm:w-5 sm:h-5 rounded-full bg-white/30" />
  </motion.div>
);

const AmongUsMinion = ({ color, x, y, delay }: { color: string; x: number; y: number; delay: number }) => (
  <motion.div
    className="absolute z-0 hidden md:block"
    initial={{ opacity: 0, x, y }}
    animate={{ opacity: 0.7, x: [x - 20, x + 20, x], y: [y - 20, y + 20, y] }}
    transition={{
      opacity: { delay, duration: 0.5 },
      x: { delay, duration: 5, repeat: Infinity, repeatType: 'reverse' },
      y: { delay, duration: 5, repeat: Infinity, repeatType: 'reverse' },
    }}
  >
    <motion.div
      className={`w-6 h-8 md:w-8 md:h-10 ${color} rounded-t-full relative shadow-lg`}
      animate={{ rotateY: [0, 180, 0] }}
      transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
    >
      <div className="absolute top-1/4 left-1/4 w-3 h-2 md:w-4 md:h-3 bg-[#C6E3FF] rounded-full" />
      <div className="absolute bottom-0 left-0 w-full h-1/3 bg-[#7C9DB5] rounded-b-lg" />
    </motion.div>
  </motion.div>
);

// Function to dynamically calculate positions based on viewport
const useViewportPositions = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  
  useEffect(() => {
    const updateSize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    window.addEventListener('resize', updateSize);
    updateSize();
    
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  return size;
};

export const Layout = ({ children }: LayoutProps) => {
  const router = useRouter();
  const { address } = useAccount();
  const { width, height } = useViewportPositions();

  return (
    <div className="min-h-screen bg-[#1F48B0] relative overflow-hidden">
      <motion.div
        className="absolute inset-0 z-0"
        animate={{
          background: [
            'linear-gradient(45deg, #1F48B0, #4A0E8F)',
            'linear-gradient(45deg, #4A0E8F, #1F48B0)',
            'linear-gradient(45deg, #1F48B0, #4A0E8F)',
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
      />
      
      <div className="absolute inset-0 bg-[url('/assets/noise.png')] opacity-5 mix-blend-overlay"></div>
      
      {width > 0 && (
        <>
          <FloatingIcon Icon={Pencil} x={width * 0.1} y={height * 0.15} delay={0.5} />
          <FloatingIcon Icon={Eraser} x={width * 0.9} y={height * 0.25} delay={0.7} />
          <FloatingIcon Icon={PaintBucket} x={width * 0.25} y={height * 0.85} delay={0.9} />
          
          <Scribble x={width * 0.15} y={height * 0.3} delay={0.3} />
          <Scribble x={width * 0.85} y={height * 0.4} delay={0.6} />
          <Scribble x={width * 0.4} y={height * 0.7} delay={0.9} />

          <AmongUsMinion color="bg-red-500" x={width * 0.05} y={height * 0.05} delay={0.5} />
          <AmongUsMinion color="bg-blue-500" x={width * 0.95} y={height * 0.1} delay={0.7} />
          <AmongUsMinion color="bg-green-500" x={width * 0.08} y={height * 0.9} delay={0.9} />
        </>
      )}
      
      <CursorTrail />
      
      <nav className="backdrop-blur-md bg-[#1F48B0]/80 border-b border-white/20 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 md:h-20">
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="relative">
                <Palette className="w-6 h-6 md:w-8 md:h-8 text-white filter drop-shadow-lg" />
                <motion.div 
                  className="absolute -inset-1 rounded-full bg-white/20 -z-10"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <button
                onClick={() => router.push('/')}
                className="text-xl md:text-2xl font-bold text-white hover:opacity-80 transition-opacity"
              >
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200 filter drop-shadow-sm">
                  SKETCHY
                </span>
              </button>
            </motion.div>
            
            <div className="flex items-center gap-3 md:gap-6">
              <ClientOnly>
                {address ? (
                  <div className="flex items-center gap-2 md:gap-6">
                    <motion.button
                      onClick={() => router.push('/history')}
                      className="flex items-center gap-1 md:gap-2 text-white/80 hover:text-white transition-colors bg-white/5 p-2 rounded-full md:rounded-lg"
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <History className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="hidden md:inline text-sm">History</span>
                    </motion.button>
                    <motion.button
                      onClick={() => router.push('/')}
                      className="flex items-center gap-1 md:gap-2 text-white/80 hover:text-white transition-colors bg-white/5 p-2 rounded-full md:rounded-lg"
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Home className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="hidden md:inline text-sm">Home</span>
                    </motion.button>
                    <div className="scale-90 md:scale-100">
                      <ConnectButton />
                    </div>
                  </div>
                ) : (
                  <div className="scale-90 md:scale-100">
                    <ConnectButton />
                  </div>
                )}
              </ClientOnly>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 md:py-8 relative z-10">
        {children}
      </main>

      <footer className="bg-gradient-to-t from-[#1F48B0]/90 to-[#1F48B0]/70 backdrop-blur-sm border-t border-white/20 py-6 md:py-8 mt-12 md:mt-16 relative z-10 shadow-inner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="flex gap-2">
              {['bg-[#FF4B4B]', 'bg-[#FF9800]', 'bg-[#FFEB3B]', 'bg-[#4CAF50]', 'bg-[#2196F3]', 'bg-[#9C27B0]'].map((color, i) => (
                <ColorfulAvatar key={color} color={color} delay={0.1 + i * 0.1} />
              ))}
            </div>
            <p className="text-white/80 text-xs md:text-sm text-center">
              © 2025 SKETCHY. All rights reserved.
            </p>
            <div className="flex gap-4">
              <motion.a
                href="#"
                className="text-white/80 hover:text-white transition-colors text-xs md:text-sm"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                Terms
              </motion.a>
              <motion.a
                href="#"
                className="text-white/80 hover:text-white transition-colors text-xs md:text-sm"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                Privacy
              </motion.a>
              <motion.a
                href="#"
                className="text-white/80 hover:text-white transition-colors text-xs md:text-sm"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                Contact
              </motion.a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};                  