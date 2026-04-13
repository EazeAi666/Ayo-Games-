import { GameSession, GameType, Player, Difficulty } from '../types';
import { db, auth } from '../lib/firebase';
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
  deleteDoc
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

class GameService {
  private get sessionsCollection() {
    if (!db) throw new Error('Firestore database not initialized. Please check your Firebase configuration.');
    return collection(db, 'games');
  }

  private get usersCollection() {
    if (!db) throw new Error('Firestore database not initialized. Please check your Firebase configuration.');
    return collection(db, 'users');
  }

  private handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth?.currentUser?.uid,
        email: auth?.currentUser?.email,
        emailVerified: auth?.currentUser?.emailVerified,
        isAnonymous: auth?.currentUser?.isAnonymous,
        tenantId: auth?.currentUser?.tenantId,
        providerInfo: auth?.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  private sanitize(obj: any): any {
    return JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));
  }

  async updateUserProfile(player: Player): Promise<void> {
    const path = `users/${player.id}`;
    try {
      const userRef = doc(this.usersCollection, player.id);
      await setDoc(userRef, this.sanitize({
        ...player,
        lastActive: Date.now()
      }), { merge: true });
    } catch (error) {
      this.handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async createGame(type: GameType, host: Player): Promise<GameSession> {
    const id = Math.random().toString(36).substring(2, 9);
    const path = `games/${id}`;
    const session: GameSession = {
      id,
      type,
      status: 'waiting',
      players: [host],
      currentTurn: host.id,
      state: this.getInitialState(type),
      createdAt: Date.now(),
    };
    
    try {
      await setDoc(doc(this.sessionsCollection, id), this.sanitize(session));
      return session;
    } catch (error) {
      this.handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  }

  async createAIGame(type: GameType, host: Player, difficulty: Difficulty = 'hard'): Promise<GameSession> {
    const id = `ai_${Math.random().toString(36).substring(2, 9)}`;
    const path = `games/${id}`;
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
    
    try {
      await setDoc(doc(this.sessionsCollection, id), this.sanitize(session));
      return session;
    } catch (error) {
      this.handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  }

  async createLocalGame(type: GameType, host: Player, playerCount: number): Promise<GameSession> {
    const id = `local_${Math.random().toString(36).substring(2, 9)}`;
    const path = `games/${id}`;
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
    
    try {
      await setDoc(doc(this.sessionsCollection, id), this.sanitize(session));
      return session;
    } catch (error) {
      this.handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  }

  async joinGame(id: string, player: Player): Promise<GameSession> {
    const path = `games/${id}`;
    try {
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
        
        await updateDoc(docRef, this.sanitize(updates));
        return { ...session, ...updates };
      }
      
      return session;
    } catch (error) {
      this.handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  }

  async updateGameState(id: string, newState: any, nextTurn?: string): Promise<void> {
    const path = `games/${id}`;
    try {
      const docRef = doc(this.sessionsCollection, id);
      const updates: any = { state: newState };
      if (nextTurn) updates.currentTurn = nextTurn;
      
      await updateDoc(docRef, this.sanitize(updates));
    } catch (error) {
      this.handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async updateSession(id: string, updates: Partial<GameSession>): Promise<void> {
    const path = `games/${id}`;
    try {
      const docRef = doc(this.sessionsCollection, id);
      await updateDoc(docRef, this.sanitize(updates));
    } catch (error) {
      this.handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async completeGame(id: string, winnerId: string): Promise<void> {
    const path = `games/${id}`;
    try {
      const docRef = doc(this.sessionsCollection, id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      const session = snap.data() as GameSession;
      
      if (session.status === 'finished') return;

      await updateDoc(docRef, this.sanitize({
        status: 'finished',
        winner: winnerId
      }));

      // Update global stats in Firestore
      for (const p of session.players) {
        if (p.id.startsWith('ai_') || p.id.startsWith('local_')) continue;
        
        const userPath = `users/${p.id}`;
        try {
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
        } catch (error) {
          console.error(`Error updating user ${p.id} stats:`, error);
          // Don't throw here to allow other updates to proceed
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
    } catch (error) {
      this.handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getLeaderboard(): Promise<any[]> {
    const path = 'users';
    try {
      const q = query(this.usersCollection, orderBy('wins', 'desc'), limit(10));
      const snap = await getDocs(q);
      return snap.docs.map(doc => doc.data());
    } catch (error) {
      this.handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
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
    const path = `games/${id}`;
    return onSnapshot(doc(this.sessionsCollection, id), (doc) => {
      if (doc.exists()) {
        callback(doc.data() as GameSession);
      }
    }, (error) => {
      this.handleFirestoreError(error, OperationType.GET, path);
    });
  }

  async getActiveGames(): Promise<GameSession[]> {
    const path = 'games';
    try {
      const q = query(this.sessionsCollection, where('status', '==', 'waiting'), limit(20));
      const snap = await getDocs(q);
      return snap.docs.map(doc => doc.data() as GameSession);
    } catch (error) {
      this.handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }

  async getResumeableGame(userId: string, type: GameType): Promise<GameSession | null> {
    const path = 'games';
    try {
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
    } catch (error) {
      this.handleFirestoreError(error, OperationType.LIST, path);
      return null;
    }
  }

  async deleteSession(id: string) {
    const path = `games/${id}`;
    try {
      await deleteDoc(doc(this.sessionsCollection, id));
    } catch (error) {
      this.handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export const gameService = new GameService();
