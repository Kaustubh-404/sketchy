

// import { Address } from 'viem';

export interface Player {
  address: string;
  name: string;
  isCurrentPlayer?: boolean; // Added this property
}

export interface GameState {
  currentWord: string;
  currentDrawer: string;
  players: Player[];
  points: Record<string, number>;
  timeLeft: number;
  isActive: boolean;
  isGameStarted: boolean;
  roundActive: boolean;
  playersWhoDrawn: string[];
  correctGuessers: string[];
}

export interface Message {
  player: string;
  text: string;
  type: 'chat' | 'system' | 'guess';
}

export interface DrawLine {
  start: Point;
  end: Point;
}

export interface Point {
  x: number;
  y: number;
}

export interface GameHistory {
  gameCode: string;
  winner: string;
  prizeAmount: bigint;
  timestamp: number;
  transactionHash?: string;
}

export interface RoomDetails {
  owner: string;
  wagerAmount: bigint;
  maxPlayers: number;
  players: string[];
  isActive: boolean;
  isCompleted: boolean;
  winner: string;
}

export interface DrawingSettings {
  color: string;
  size: number;
}

export interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  roundStart: (data: { drawer: string; word: string; timeLeft: number }) => void;
  roundEnd: (data: { scores: Record<string, number>; nextDrawer: string; word: string }) => void;
  gameEnd: (data: { winner: string; points: Record<string, number>; totalPrize: bigint }) => void;
  timeUpdate: (time: number) => void;
  correctGuess: (data: { player: string; points: number }) => void;
  wrongGuess: (data: { guess: string }) => void;
  chatMessage: Message;
  drawUpdate: { lines: DrawLine[] };
}

export interface ClientToServerEvents {
  guess: (guess: string) => void;
  draw: (data: { lines: DrawLine[] }) => void;
  startGame: () => void;
  chatMessage: (message: string) => void;
}