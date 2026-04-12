import { GameSession, GameType, Player, Difficulty } from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';

class GameService {
  private sessionsCollection = collection(db, 'games');
  private usersCollection = collection(db, 'users');

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
    
    await setDoc(doc(this.sessionsCollection, id), session);
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
      currentTurn: host.color === 'black' ? 'ai_bot' : host.id,
      state: this.getInitialState(type),
      createdAt: Date.now(),
      isAI: true,
      difficulty,
    };
    
    await setDoc(doc(this.sessionsCollection, id), session);
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
    
    await setDoc(doc(this.sessionsCollection, id), session);
    return session;
  }

  async joinGame(id: string, player: Player): Promise<GameSession> {
    const docRef = doc(this.sessionsCollection, id);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) throw new Error('Game not found');
    const session = snap.data() as GameSession;
    
    if (session.players.length >= this.getMaxPlayers(session.type)) {
      throw new Error('Game is full');
    }
    
    if (!session.players.find(p => p.id === player.id)) {
      const updatedPlayers = [...session.players, player];
      const updates: any = { players: updatedPlayers };
      
      if (updatedPlayers.length === this.getMaxPlayers(session.type)) {
        updates.status = 'playing';
      }
      
      await updateDoc(docRef, updates);
      return { ...session, ...updates };
    }
    
    return session;
  }

  async updateGameState(id: string, newState: any, nextTurn?: string): Promise<void> {
    const docRef = doc(this.sessionsCollection, id);
    const updates: any = { state: newState };
    if (nextTurn) updates.currentTurn = nextTurn;
    
    await updateDoc(docRef, updates);
  }

  async updateSession(id: string, updates: Partial<GameSession>): Promise<void> {
    const docRef = doc(this.sessionsCollection, id);
    await updateDoc(docRef, updates);
  }

  async completeGame(id: string, winnerId: string): Promise<void> {
    const docRef = doc(this.sessionsCollection, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const session = snap.data() as GameSession;
    
    if (session.status === 'finished') return;

    await updateDoc(docRef, {
      status: 'finished',
      winner: winnerId
    });

    // Update global stats in Firestore
    for (const p of session.players) {
      if (p.id.startsWith('ai_') || p.id.startsWith('local_')) continue;
      
      const userRef = doc(this.usersCollection, p.id);
      const userSnap = await getDoc(userRef);
      const isWinner = p.id === winnerId;
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        await updateDoc(userRef, {
          wins: (userData.wins || 0) + (isWinner ? 1 : 0),
          losses: (userData.losses || 0) + (isWinner ? 0 : 1),
          lastActive: Date.now()
        });
      } else {
        await setDoc(userRef, {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          wins: isWinner ? 1 : 0,
          losses: isWinner ? 0 : 1,
          lastActive: Date.now()
        });
      }
    }

    // Update local user stats cache
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
  }

  async getLeaderboard(): Promise<any[]> {
    const q = query(this.usersCollection, orderBy('wins', 'desc'), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
  }

  private getInitialState(type: GameType) {
    switch (type) {
      case 'chess':
        return { fen: 'start', history: [] };
      case 'whot':
        return { deck: [], discardPile: [], playerHands: {} };
      case 'ludo':
        return { positions: {}, diceValues: [0, 0], canRoll: true, usedDice: [false, false] };
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
    return onSnapshot(doc(this.sessionsCollection, id), (doc) => {
      if (doc.exists()) {
        callback(doc.data() as GameSession);
      }
    });
  }

  async getActiveGames(): Promise<GameSession[]> {
    const q = query(this.sessionsCollection, where('status', '==', 'waiting'), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as GameSession);
  }

  async getResumeableGame(userId: string, type: GameType): Promise<GameSession | null> {
    const q = query(
      this.sessionsCollection, 
      where('type', '==', type),
      where('status', '==', 'playing'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const snap = await getDocs(q);
    const sessions = snap.docs.map(doc => doc.data() as GameSession);
    return sessions.find(s => s.players.some(p => p.id === userId)) || null;
  }

  async deleteSession(id: string) {
    await deleteDoc(doc(this.sessionsCollection, id));
  }
}

export const gameService = new GameService();
