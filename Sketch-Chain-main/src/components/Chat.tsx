import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '@/store/gameStore';
import { toast } from 'react-hot-toast';
import { useAccount } from 'wagmi';

interface ChatProps {
  socket: Socket | null;
}

interface ChatMessage {
  player: string;
  text: string;
  type: 'guess' | 'system' | 'chat' | 'correct';
}

export const Chat = ({ socket }: ChatProps) => {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    chatMessages,
    isDrawing,
    roundActive,
    correctGuessers,
    currentDrawer,
    currentWord,
    addCorrectGuesser,
    clearCorrectGuessers,
    setCurrentWord
  } = useGameStore();
  
  const { address } = useAccount();

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (!socket) return;

    const handleRoundStart = ({ word }: { drawer: string, word: string, timeLeft: number }) => {
      console.log("Round started with new word:", word);
      // Reset correct guessers at the start of a new round
      clearCorrectGuessers();
      setCurrentWord(word);
    };

    const handleRoundEnd = ({ word }: { word: string }) => {
      toast(`The Word was: ${word}`, {
        icon: '📢',
        style: {
          background: '#f59e0b',
          color: '#ffffff',
          zIndex: 9999
        },
        duration: 3000,
      });
      // Make sure to clear guessers at round end too
      clearCorrectGuessers();
    };

    const handleCorrectGuess = ({ player }: { player: string }) => {
      console.log("Player guessed correctly:", player);
      addCorrectGuesser(player); // Add correct guesser to the list
    };

    socket.on('roundStart', handleRoundStart);
    socket.on('roundEnd', handleRoundEnd);
    socket.on('correctGuess', handleCorrectGuess);
    
    return () => {
      socket.off('roundStart', handleRoundStart);
      socket.off('roundEnd', handleRoundEnd);
      socket.off('correctGuess', handleCorrectGuess);
    };
  }, [socket, addCorrectGuesser, clearCorrectGuessers, setCurrentWord]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !message.trim()) return;

    if (isDrawing) {
      socket.emit('chatMessage', message);
    } else {
      socket.emit('guess', message);
    }
    setMessage('');
  };

  // Helper function to determine if a user can see the word
  const userCanSeeWord = () => {
    if (!address) return false;
    
    // Drawer can always see the word
    if (isDrawing || currentDrawer === address) return true;
    
    // People who have guessed correctly can see the word
    return correctGuessers.includes(address);
  };

  return (
    <div className="flex flex-col h-full max-h-[400px] md:h-[400px] bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 shadow-lg overflow-hidden">
      <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2">
        {chatMessages.map((msg: ChatMessage, index) => {
          // Determine if this message contains the correct word
          const containsCorrectWord = currentWord && 
            msg.text.toLowerCase().includes(currentWord.toLowerCase());
          
          // Hide message content if it contains the correct word and user can't see it
          const shouldHideWord = (msg.type === 'correct' || 
            (msg.type === 'guess' && containsCorrectWord)) && !userCanSeeWord();

          return (
            <div
              key={index}
              className={`p-2 rounded-lg text-sm md:text-base ${
                msg.type === 'system'
                  ? 'bg-white/5 text-gray-200'
                  : msg.type === 'guess'
                  ? 'bg-blue-500/30 text-white'
                  : msg.type === 'correct'
                  ? 'bg-green-500/30 text-white'
                  : 'bg-white/5 text-white'
              } max-w-[90%] ${msg.type === 'guess' || msg.type === 'correct' ? 'ml-auto' : ''}`}
            >
              <div className="text-xs text-gray-300 font-medium">
                {msg.player.slice(0, 6)}...
              </div>
              <div className="break-words">
                {shouldHideWord ? '****' : msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="p-2 md:p-4 border-t border-white/20">
        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isDrawing ? "Chat..." : "Enter your guess..."}
            className="flex-1 px-3 py-2 bg-white/10 text-white placeholder-gray-300 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            disabled={!roundActive}
          />
          <button
            type="submit"
            disabled={!roundActive}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-500/50 disabled:text-gray-300 transition-colors duration-200"
          >
            Send
          </button>
        </div>
      </form> 
    </div>
  );
};