export type GameType = 'chess' | 'whot' | 'ludo' | 'ayo';
export type Difficulty = 'easy' | 'hard' | 'very_hard';

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  wins?: number;
  losses?: number;
}

export interface GameSession {
  id: string;
  type: GameType;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  currentTurn: string; // Player ID
  state: any; // Game specific state
  winner?: string; // Player ID
  createdAt: number;
  isAI?: boolean;
  isLocal?: boolean;
  difficulty?: Difficulty;
}

// Chess specific state
export interface ChessState {
  fen: string;
  history: string[];
}

// Whot specific state
export interface WhotState {
  deck: string[];
  discardPile: string[];
  playerHands: Record<string, string[]>;
  currentSuit?: string; // For Whot (20) card
  penalty?: number;
}

// Ludo specific state
export interface LudoState {
  positions: Record<string, number[]>; // PlayerID -> [pos1, pos2, pos3, pos4]
  diceValues: number[];
  canRoll: boolean;
}

// Ayo specific state
export interface AyoState {
  pits: number[]; // 12 pits, 6 for each player
  captured: Record<string, number>;
}
