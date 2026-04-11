import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameSession, Player } from './types';
import { gameService } from './services/gameService';
import Lobby from './components/Lobby';
import ChessGame from './components/games/ChessGame';
import WhotGame from './components/games/WhotGame';
import LudoGame from './components/games/LudoGame';
import AyoGame from './components/games/AyoGame';
import { Trophy, Users, Gamepad2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function App() {
  const [user, setUser] = useState<Player | null>(null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);

  useEffect(() => {
    if (activeSession) {
      const unsubscribe = gameService.subscribe(activeSession.id, (updatedSession) => {
        setActiveSession(updatedSession);
      });
      return unsubscribe;
    }
  }, [activeSession?.id]);

  useEffect(() => {
    // Simple local user persistence
    const savedUser = localStorage.getItem('ayo_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (name: string) => {
    const newUser: Player = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
      wins: 0,
      losses: 0,
    };
    setUser(newUser);
    localStorage.setItem('ayo_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    setActiveSession(null);
    localStorage.removeItem('ayo_user');
  };

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
          <p className="text-zinc-400 text-center mb-8">Enter your name to start playing</p>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const name = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value;
            if (name) handleLogin(name);
          }}>
            <input
              name="name"
              type="text"
              placeholder="Your Nickname"
              required
              className="w-full bg-zinc-800 border-zinc-700 text-white rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            />
            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-6 rounded-lg transition-all">
              Join Lobby
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
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
  );
}
