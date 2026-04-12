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
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

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
          const parsed = JSON.parse(savedUser);
          userData = { 
            ...parsed, 
            id: firebaseUser.uid,
            name: parsed.name || firebaseUser.displayName || "Guest",
            avatar: parsed.avatar || firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`
          };
        } else {
          userData = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || "Guest",
            avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
            wins: 0,
            losses: 0,
          };
        }
        
        setUser(userData);
        localStorage.setItem('ayo_user', JSON.stringify(userData));
        await gameService.updateUserProfile(userData);
      } else {
        // Automatically sign in anonymously if not logged in
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anonymous Auth Error:", error);
          setUser(null);
        }
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

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
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
