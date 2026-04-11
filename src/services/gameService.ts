import { GameSession, GameType, Player, Difficulty } from '../types';

// Mocking Firebase for now due to setup issues
// This service will handle game creation, joining, and state updates

class GameService {
  private sessions: Record<string, GameSession> = {};

  constructor() {
    const saved = localStorage.getItem('ayo_games_sessions');
    if (saved) {
      this.sessions = JSON.parse(saved);
    }
  }

  private save() {
    localStorage.setItem('ayo_games_sessions', JSON.stringify(this.sessions));
  }

  async createGame(type: GameType, host: Player): Promise<GameSession> {
    const id = Math.random().toString(36).substring(2, 9);
    const session: GameSession = {
      id,
      type,
      status: 'waiting',
      players: [host],
      currentTurn: host.id,
      state: this.getInitialState(type),
      createdAt: Date.now(),
    };
    this.sessions[id] = session;
    this.save();
    return session;
  }

  async createAIGame(type: GameType, host: Player, difficulty: Difficulty = 'hard'): Promise<GameSession> {
    const id = `ai_${Math.random().toString(36).substring(2, 9)}`;
    const aiPlayer: Player = {
      id: 'ai_bot',
      name: 'Computer',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=computer',
      color: host.color === 'white' ? 'black' : 'white',
    };
    const session: GameSession = {
      id,
      type,
      status: 'playing',
      players: [host, aiPlayer],
      currentTurn: host.color === 'black' ? 'ai_bot' : host.id, // White always starts in Chess
      state: this.getInitialState(type),
      createdAt: Date.now(),
      isAI: true,
      difficulty,
    };
    this.sessions[id] = session;
    this.save();
    return session;
  }

  async createLocalGame(type: GameType, host: Player, playerCount: number): Promise<GameSession> {
    const id = `local_${Math.random().toString(36).substring(2, 9)}`;
    const players: Player[] = [host];
    
    for (let i = 1; i < playerCount; i++) {
      players.push({
        id: `local_player_${i}`,
        name: `Player ${i + 1}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=local${i}`,
      });
    }

    const session: GameSession = {
      id,
      type,
      status: 'playing',
      players,
      currentTurn: type === 'chess' ? players.find(p => p.color === 'white')?.id || host.id : host.id,
      state: this.getInitialState(type),
      createdAt: Date.now(),
      isLocal: true,
    };
    this.sessions[id] = session;
    this.save();
    return session;
  }

  async joinGame(id: string, player: Player): Promise<GameSession> {
    const session = this.sessions[id];
    if (!session) throw new Error('Game not found');
    if (session.players.length >= this.getMaxPlayers(session.type)) {
      throw new Error('Game is full');
    }
    if (!session.players.find(p => p.id === player.id)) {
      session.players.push(player);
      if (session.players.length === this.getMaxPlayers(session.type)) {
        session.status = 'playing';
      }
      this.save();
    }
    return session;
  }

  async updateGameState(id: string, newState: any, nextTurn?: string): Promise<void> {
    const session = this.sessions[id];
    if (!session) return;
    
    // Create new session object to trigger React updates
    const updatedSession = {
      ...session,
      state: newState,
      currentTurn: nextTurn || session.currentTurn
    };
    
    this.sessions[id] = updatedSession;
    this.save();
    
    window.dispatchEvent(new CustomEvent(`game_update_${id}`, { detail: updatedSession }));
  }

  async updateSession(id: string, updates: Partial<GameSession>): Promise<void> {
    const session = this.sessions[id];
    if (!session) return;

    const updatedSession = {
      ...session,
      ...updates
    };

    this.sessions[id] = updatedSession;
    this.save();

    window.dispatchEvent(new CustomEvent(`game_update_${id}`, { detail: updatedSession }));
  }

  async completeGame(id: string, winnerId: string): Promise<void> {
    const session = this.sessions[id];
    if (!session || session.status === 'finished') return;

    const updatedSession: GameSession = {
      ...session,
      status: 'finished',
      winner: winnerId
    };

    this.sessions[id] = updatedSession;
    this.save();

    // Update local user stats if they are in the game
    const savedUser = localStorage.getItem('ayo_user');
    if (savedUser) {
      const user: Player = JSON.parse(savedUser);
      const isWinner = user.id === winnerId;
      const isInGame = session.players.some(p => p.id === user.id);

      if (isInGame) {
        user.wins = (user.wins || 0) + (isWinner ? 1 : 0);
        user.losses = (user.losses || 0) + (isWinner ? 0 : 1);
        localStorage.setItem('ayo_user', JSON.stringify(user));
      }
    }

    window.dispatchEvent(new CustomEvent(`game_update_${id}`, { detail: updatedSession }));
  }

  private getInitialState(type: GameType) {
    switch (type) {
      case 'chess':
        return { fen: 'start', history: [] };
      case 'whot':
        return { deck: [], discardPile: [], playerHands: {} };
      case 'ludo':
        return { positions: {}, diceValue: 0, canRoll: true };
      case 'ayo':
        return { pits: Array(12).fill(4), captured: {} };
    }
  }

  private getMaxPlayers(type: GameType) {
    switch (type) {
      case 'chess': return 2;
      case 'whot': return 4;
      case 'ludo': return 4;
      case 'ayo': return 2;
    }
  }

  subscribe(id: string, callback: (session: GameSession) => void) {
    const handler = (e: any) => callback(JSON.parse(JSON.stringify(e.detail)));
    window.addEventListener(`game_update_${id}`, handler);
    // Initial call
    if (this.sessions[id]) callback(JSON.parse(JSON.stringify(this.sessions[id])));
    return () => window.removeEventListener(`game_update_${id}`, handler);
  }

  async getActiveGames(): Promise<GameSession[]> {
    return Object.values(this.sessions).filter(s => s.status === 'waiting');
  }
}

export const gameService = new GameService();
