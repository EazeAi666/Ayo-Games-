import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameSession, Player } from './types';
import { gameService } from './services/gameService';
import Lobby from './components/Lobby';
import ChessGame from './components/games/ChessGame';
import WhotGame from './components/games/WhotGame';
import LudoGame from './components/games/LudoGame';
import AyoGame from './components/games/AyoGame';
import { Trophy, Users, Gamepad2, LogOut, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth } from './lib/firebase';
import { signInAnonymously, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { Input } from '@/components/ui/input';
import { User } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorDetails = this.state.error?.message || "An unexpected error occurred.";
      let isPermissionError = errorDetails.includes("Missing or insufficient permissions");
      
      try {
        // Try to parse JSON error from gameService
        const parsed = JSON.parse(errorDetails);
        errorDetails = parsed.error;
      } catch (e) {
        // Not JSON, use as is
      }

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900 border border-red-900/50 p-8 rounded-2xl shadow-2xl text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-4">Something went wrong</h1>
            <div className="bg-black/40 rounded-lg p-4 mb-6 text-left">
              <p className="text-red-400 text-sm font-mono break-all">{errorDetails}</p>
            </div>
            {isPermissionError && (
              <p className="text-zinc-400 text-sm mb-6">
                This usually happens if you're not logged in or don't have access to this game. 
                Try logging out and back in.
              </p>
            )}
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<Player | null>(null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const savedUser = localStorage.getItem('ayo_user');
        let userData: Player;
        
        if (savedUser) {
          userData = { ...JSON.parse(savedUser), id: firebaseUser.uid };
        } else {
          userData = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || "Player",
            avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
            wins: 0,
            losses: 0,
          };
        }
        
        setUser(userData);
        localStorage.setItem('ayo_user', JSON.stringify(userData));
        await gameService.updateUserProfile(userData);
      } else {
        setUser(null);
      }
      setIsAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (activeSession) {
      const unsubscribe = gameService.subscribe(activeSession.id, (updatedSession) => {
        setActiveSession(updatedSession);
      });
      return unsubscribe;
    }
  }, [activeSession?.id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    if (!auth) {
      alert("Firebase Authentication is not initialized. Please check your configuration.");
      return;
    }
    try {
      setIsLoggingIn(true);
      const { user: firebaseUser } = await signInAnonymously(auth);
      await updateProfile(firebaseUser, { displayName: nickname });
      
      const userData: Player = {
        id: firebaseUser.uid,
        name: nickname,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
        wins: 0,
        losses: 0,
      };
      
      setUser(userData);
      localStorage.setItem('ayo_user', JSON.stringify(userData));
      await gameService.updateUserProfile(userData);
    } catch (error: any) {
      console.error("Auth Error:", error);
      alert(`Login failed: ${error.message}. Please ensure Anonymous Auth is enabled in your Firebase Console.`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
    }
    setUser(null);
    setActiveSession(null);
    localStorage.removeItem('ayo_user');
  };

  if (!auth) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
              <Gamepad2 className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Config Error</h1>
          <p className="text-zinc-400 mb-8">
            Firebase is not correctly configured. Please ensure <code className="bg-zinc-800 px-1 rounded">firebase-applet-config.json</code> exists.
          </p>
        </div>
      </div>
    );
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Gamepad2 className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center text-white mb-2">Ayo Games</h1>
          <p className="text-zinc-400 text-center mb-8">Enter a nickname to start playing</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <Input
                type="text"
                placeholder="Your Nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="pl-10 bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl focus:ring-orange-500"
                maxLength={15}
                required
              />
            </div>
            <Button 
              type="submit"
              disabled={isLoggingIn || !nickname.trim()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Start Playing"
              )}
            </Button>
          </form>
          <p className="text-xs text-zinc-500 text-center mt-6">
            Multiplayer games require a connection to our game server.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveSession(null)}>
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">AYO GAMES</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-700">
                <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full" />
                <span className="text-sm font-medium">{user.name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-zinc-400 hover:text-white">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto p-2 md:p-8">
          <AnimatePresence mode="wait">
            {!activeSession ? (
              <motion.div
                key="lobby"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Lobby user={user} onJoinGame={setActiveSession} />
              </motion.div>
            ) : (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full"
              >
                <div className="mb-6 flex items-center justify-between">
                  <Button variant="outline" onClick={() => setActiveSession(null)} className="border-zinc-700 hover:bg-zinc-800">
                    Back to Lobby
                  </Button>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-zinc-400">
                      {activeSession.players.length} / {activeSession.type === 'chess' ? 2 : 4} Players
                    </span>
                  </div>
                </div>

                {activeSession.type === 'chess' && <ChessGame session={activeSession} user={user} />}
                {activeSession.type === 'whot' && <WhotGame session={activeSession} user={user} />}
                {activeSession.type === 'ludo' && <LudoGame session={activeSession} user={user} />}
                {activeSession.type === 'ayo' && <AyoGame session={activeSession} user={user} />}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </ErrorBoundary>
  );
}
