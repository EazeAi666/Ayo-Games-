import { useState, useEffect } from 'react';
import { GameSession, Player, AyoState } from '../../types';
import { gameService } from '../../services/gameService';
import { aiService } from '../../services/aiService';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, ArrowLeft, RotateCcw, Info } from 'lucide-react';

interface AyoGameProps {
  session: GameSession;
  user: Player;
}

export default function AyoGame({ session, user }: AyoGameProps) {
  const gameState = session.state as AyoState;
  const [isThinking, setIsThinking] = useState(false);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);

  const isMyTurn = session.currentTurn === user.id;
  const isLocalTurn = session.isLocal;
  const canIPlay = isMyTurn || isLocalTurn;

  // AI Turn Logic
  useEffect(() => {
    if (session.isAI && session.currentTurn === 'ai_bot' && session.status === 'playing') {
      const triggerAI = async () => {
        setIsThinking(true);
        await new Promise(r => setTimeout(r, 1500));
        const move = await aiService.getAyoMove(gameState.pits, session.difficulty);
        if (move !== -1) {
          playPit(move, 'ai_bot');
        }
        setIsThinking(false);
      };
      triggerAI();
    }
  }, [session.currentTurn, session.isAI, session.status]);

  const playPit = async (pitIndex: number, playerId: string = user.id) => {
    if (session.currentTurn !== playerId || session.status !== 'playing') return;
    
    // Validate pit ownership
    const playerIdx = session.players.findIndex(p => p.id === playerId);
    const isPlayer1 = playerIdx === 0;
    if (isPlayer1 && (pitIndex < 0 || pitIndex > 5)) return;
    if (!isPlayer1 && (pitIndex < 6 || pitIndex > 11)) return;
    
    if (gameState.pits[pitIndex] === 0) return;

    let pits = [...gameState.pits];
    let captured = { ...gameState.captured };
    let seeds = pits[pitIndex];
    pits[pitIndex] = 0;

    let currentPit = pitIndex;
    
    // Sowing animation
    for (let i = 0; i < seeds; i++) {
      currentPit = (currentPit + 1) % 12;
      if (currentPit === pitIndex) {
        currentPit = (currentPit + 1) % 12;
      }
      pits[currentPit]++;
      
      // Update state incrementally for animation effect
      gameService.updateGameState(session.id, { pits: [...pits], captured }, session.currentTurn);
      await new Promise(r => setTimeout(r, 200));
    }

    // Capture logic
    const isOpponentPit = isPlayer1 ? (currentPit >= 6 && currentPit <= 11) : (currentPit >= 0 && currentPit <= 5);
    
    if (isOpponentPit) {
      let tempPit = currentPit;
      while (true) {
        const pitSeeds = pits[tempPit];
        const isStillOpponentPit = isPlayer1 ? (tempPit >= 6 && tempPit <= 11) : (tempPit >= 0 && tempPit <= 5);
        
        if (isStillOpponentPit && (pitSeeds === 2 || pitSeeds === 3)) {
          captured[playerId] = (captured[playerId] || 0) + pitSeeds;
          pits[tempPit] = 0;
          
          // Move backwards to check previous pits for capture
          tempPit = (tempPit - 1 + 12) % 12;
        } else {
          break;
        }
      }
    }

    setLastMove(pitIndex);

    // Check for game end
    const totalSeeds = pits.reduce((a, b) => a + b, 0);
    const p1PitsEmpty = pits.slice(0, 6).every(p => p === 0);
    const p2PitsEmpty = pits.slice(6, 12).every(p => p === 0);

    if (totalSeeds < 8 || p1PitsEmpty || p2PitsEmpty) {
      // Game over
      const p1Score = (captured[session.players[0].id] || 0) + (p1PitsEmpty ? 0 : pits.slice(0, 6).reduce((a, b) => a + b, 0));
      const p2Score = (captured[session.players[1].id] || 0) + (p2PitsEmpty ? 0 : pits.slice(6, 12).reduce((a, b) => a + b, 0));
      
      const winnerId = p1Score > p2Score ? session.players[0].id : session.players[1].id;
      gameService.completeGame(session.id, winnerId);
    } else {
      const nextTurnIndex = (session.players.findIndex(p => p.id === playerId) + 1) % session.players.length;
      gameService.updateGameState(session.id, { pits, captured }, session.players[nextTurnIndex].id);
    }
  };

  const p1 = session.players[0];
  const p2 = session.players[1];
  const isP1 = user.id === p1.id;

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] flex flex-col items-center py-12 px-4 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-900/10 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-12 z-10">
        <Button 
          variant="ghost" 
          onClick={() => gameService.updateSession(session.id, { status: 'waiting' })}
          className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-full"
        >
          <ArrowLeft className="w-5 h-5 mr-2" /> Lobby
        </Button>
        <div className="text-center">
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <span className="text-red-600">AYO</span> BOARD
          </h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Strategic Seed Sowing</p>
        </div>
        <Button 
          variant="ghost" 
          onClick={() => setShowRules(true)}
          className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-full"
        >
          <Info className="w-5 h-5" />
        </Button>
      </div>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-lg w-full shadow-2xl overflow-y-auto max-h-[80vh]"
            >
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <Info className="text-red-600" /> AYO RULES
              </h2>
              <div className="space-y-4 text-zinc-400 text-sm">
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <p className="text-white font-bold mb-1">Objective:</p>
                  <p>Capture more seeds than your opponent. There are 48 seeds in total.</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <p className="text-white font-bold mb-1">Sowing:</p>
                  <p>Select a pit on your side. Seeds are distributed one by one counter-clockwise into subsequent pits.</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <p className="text-white font-bold mb-1">Capturing:</p>
                  <p>If your last seed lands in an opponent's pit and makes the total seeds in that pit 2 or 3, you capture those seeds. You also capture seeds in preceding pits if they also contain 2 or 3 seeds.</p>
                </div>
              </div>
              <Button onClick={() => setShowRules(false)} className="w-full mt-8 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl">
                GOT IT
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Board Container */}
      <div className="w-full max-w-4xl bg-zinc-900/50 border border-zinc-800 rounded-[3rem] p-12 shadow-2xl relative">
        
        {/* Opponent Info (Top) */}
        <div className="flex items-center justify-between mb-12">
          <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${session.currentTurn === p2.id ? 'bg-red-600/10 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.2)]' : 'bg-zinc-900 border-zinc-800 opacity-60'}`}>
            <img src={p2.avatar} className="w-12 h-12 rounded-full border-2 border-white/10" alt={p2.name} />
            <div>
              <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">{p2.name}</p>
              <p className="text-2xl font-black text-white">{gameState.captured[p2.id] || 0} <span className="text-xs text-zinc-500 font-normal">Captured</span></p>
            </div>
          </div>
          {isThinking && (
            <div className="flex items-center gap-2 text-red-500 font-black text-xs uppercase tracking-tighter animate-pulse">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              Computer is thinking...
            </div>
          )}
        </div>

        {/* The Board */}
        <div className="bg-[#1a1a1a] rounded-[2.5rem] p-8 border-4 border-[#2a2a2a] shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)] relative">
          {/* Decorative Wood Texture Overlay */}
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }} />
          
          <div className="grid grid-cols-6 gap-6 relative z-10">
            {/* Player 2 Pits (Top Row, Right to Left) */}
            {[11, 10, 9, 8, 7, 6].map((idx) => (
              <div key={idx} className="flex flex-col items-center gap-3">
                <div className="text-[10px] font-black text-zinc-700 uppercase">{idx + 1}</div>
                <motion.button
                  whileHover={!isThinking && session.currentTurn === p2.id && gameState.pits[idx] > 0 ? { scale: 1.05, backgroundColor: '#2a2a2a' } : {}}
                  whileTap={!isThinking && session.currentTurn === p2.id && gameState.pits[idx] > 0 ? { scale: 0.95 } : {}}
                  onClick={() => playPit(idx, p2.id)}
                  disabled={isThinking || session.currentTurn !== p2.id || gameState.pits[idx] === 0}
                  className={`w-full aspect-square rounded-full flex items-center justify-center relative transition-all duration-300 ${
                    lastMove === idx ? 'ring-4 ring-red-600/50' : ''
                  } ${gameState.pits[idx] > 0 ? 'bg-[#121212] shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]' : 'bg-[#0a0a0a] shadow-inner'}`}
                >
                  <div className="grid grid-cols-3 gap-1 p-2">
                    {Array.from({ length: Math.min(gameState.pits[idx], 9) }).map((_, i) => (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        key={i} 
                        className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-red-500 to-red-800 shadow-lg" 
                      />
                    ))}
                    {gameState.pits[idx] > 9 && (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white bg-red-600/20 rounded-full">
                        +{gameState.pits[idx] - 9}
                      </div>
                    )}
                  </div>
                  {gameState.pits[idx] > 0 && (
                    <div className="absolute -bottom-2 bg-zinc-800 px-2 py-0.5 rounded-full text-[10px] font-black text-white border border-zinc-700">
                      {gameState.pits[idx]}
                    </div>
                  )}
                </motion.button>
              </div>
            ))}

            {/* Player 1 Pits (Bottom Row, Left to Right) */}
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex flex-col items-center gap-3 mt-8">
                <motion.button
                  whileHover={!isThinking && session.currentTurn === p1.id && gameState.pits[idx] > 0 ? { scale: 1.05, backgroundColor: '#2a2a2a' } : {}}
                  whileTap={!isThinking && session.currentTurn === p1.id && gameState.pits[idx] > 0 ? { scale: 0.95 } : {}}
                  onClick={() => playPit(idx, p1.id)}
                  disabled={isThinking || session.currentTurn !== p1.id || gameState.pits[idx] === 0}
                  className={`w-full aspect-square rounded-full flex items-center justify-center relative transition-all duration-300 ${
                    lastMove === idx ? 'ring-4 ring-red-600/50' : ''
                  } ${gameState.pits[idx] > 0 ? 'bg-[#121212] shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]' : 'bg-[#0a0a0a] shadow-inner'}`}
                >
                  <div className="grid grid-cols-3 gap-1 p-2">
                    {Array.from({ length: Math.min(gameState.pits[idx], 9) }).map((_, i) => (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        key={i} 
                        className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-400 shadow-lg" 
                      />
                    ))}
                    {gameState.pits[idx] > 9 && (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-zinc-900 bg-white/20 rounded-full">
                        +{gameState.pits[idx] - 9}
                      </div>
                    )}
                  </div>
                  {gameState.pits[idx] > 0 && (
                    <div className="absolute -top-2 bg-zinc-800 px-2 py-0.5 rounded-full text-[10px] font-black text-white border border-zinc-700">
                      {gameState.pits[idx]}
                    </div>
                  )}
                </motion.button>
                <div className="text-[10px] font-black text-zinc-700 uppercase">{idx + 1}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Player Info (Bottom) */}
        <div className="flex items-center justify-between mt-12">
          <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${session.currentTurn === p1.id ? 'bg-red-600/10 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.2)]' : 'bg-zinc-900 border-zinc-800 opacity-60'}`}>
            <img src={p1.avatar} className="w-12 h-12 rounded-full border-2 border-white/10" alt={p1.name} />
            <div>
              <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">{p1.name} (You)</p>
              <p className="text-2xl font-black text-white">{gameState.captured[p1.id] || 0} <span className="text-xs text-zinc-500 font-normal">Captured</span></p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Status</p>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${session.status === 'playing' ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`} />
              <span className="text-white font-bold uppercase text-sm tracking-tighter">
                {session.status === 'playing' ? (isMyTurn ? "Your Turn" : "Opponent Turn") : "Game Finished"}
              </span>
            </div>
          </div>
        </div>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {session.status === 'finished' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md rounded-[3rem] flex flex-col items-center justify-center p-12 text-center"
            >
              <Trophy className="w-24 h-24 text-yellow-500 mb-6" />
              <h2 className="text-5xl font-black text-white mb-2 uppercase tracking-tighter">
                {session.winner === user.id ? "Victory!" : "Defeat!"}
              </h2>
              <p className="text-zinc-400 mb-12 text-lg">
                {session.winner === user.id ? "You outsmarted the opponent!" : "Better luck next time, strategist."}
              </p>
              <div className="flex gap-4">
                <Button 
                  onClick={() => window.location.reload()}
                  className="bg-red-600 hover:bg-red-700 text-white font-black px-8 py-6 rounded-2xl text-lg uppercase tracking-widest"
                >
                  Play Again
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => gameService.updateSession(session.id, { status: 'waiting' })}
                  className="border-zinc-700 text-zinc-400 hover:text-white px-8 py-6 rounded-2xl text-lg uppercase tracking-widest"
                >
                  Lobby
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Instructions */}
      <div className="mt-12 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50">
          <h4 className="text-red-500 font-black text-xs uppercase tracking-widest mb-2">How to Play</h4>
          <p className="text-zinc-500 text-xs leading-relaxed">Select a pit on your side to sow seeds. Seeds are distributed counter-clockwise.</p>
        </div>
        <div className="bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50">
          <h4 className="text-red-500 font-black text-xs uppercase tracking-widest mb-2">Capturing</h4>
          <p className="text-zinc-500 text-xs leading-relaxed">If your last seed lands in an opponent's pit and makes it 2 or 3, you capture those seeds.</p>
        </div>
        <div className="bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50">
          <h4 className="text-red-500 font-black text-xs uppercase tracking-widest mb-2">Winning</h4>
          <p className="text-zinc-500 text-xs leading-relaxed">The game ends when a player can no longer move. The player with the most captured seeds wins.</p>
        </div>
      </div>
    </div>
  );
}
