import { useState, useEffect } from 'react';
import { GameSession, Player, LudoState } from '../../types';
import { gameService } from '../../services/gameService';
import { aiService } from '../../services/aiService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { Dice6, User, Home, Flag, Trophy, ArrowLeft, Info } from 'lucide-react';

interface LudoGameProps {
  session: GameSession;
  user: Player;
}

const COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#eab308']; // Green, Blue, Red, Yellow
const BORDER_COLORS = ['border-green-500', 'border-blue-500', 'border-red-500', 'border-yellow-500'];
const BG_COLORS = ['bg-green-500', 'bg-blue-500', 'bg-red-500', 'bg-yellow-500'];

const MAIN_PATH = [
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]
];

const HOME_PATHS = [
  [[7, 5], [7, 4], [7, 3], [7, 2], [7, 1], [7, 0]], // Green
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]], // Blue
  [[7, 9], [7, 10], [7, 11], [7, 12], [7, 13], [7, 14]], // Red
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]] // Yellow
];

const START_STEPS = [1, 14, 27, 40]; // Green, Blue, Red, Yellow start steps on MAIN_PATH
const SAFE_SQUARES = [1, 9, 14, 22, 27, 35, 40, 48]; // Indices on MAIN_PATH that are safe

const Dice = ({ value, rolling, onClick, disabled }: { value: number; rolling: boolean; onClick?: () => void; disabled?: boolean }) => {
  const dots = [
    [],
    [4],
    [0, 8],
    [0, 4, 8],
    [0, 2, 6, 8],
    [0, 2, 4, 6, 8],
    [0, 2, 3, 5, 6, 8],
  ];

  return (
    <motion.div
      whileHover={!disabled && !rolling ? { scale: 1.1, rotate: 5, y: -5 } : {}}
      whileTap={!disabled && !rolling ? { scale: 0.9 } : {}}
      onClick={!disabled && !rolling ? onClick : undefined}
      animate={rolling ? { 
        rotateX: [0, 180, 360, 540, 720],
        rotateY: [0, 180, 360, 540, 720],
        scale: [1, 1.3, 0.8, 1.1, 1],
        y: [0, -30, 0, -15, 0],
      } : { rotateX: 0, rotateY: 0, scale: 1, y: 0 }}
      transition={{ duration: 0.8, repeat: rolling ? Infinity : 0, ease: "easeInOut" }}
      className={`w-28 h-28 bg-white rounded-2xl shadow-[0_10px_20px_rgba(0,0,0,0.3)] border-4 ${disabled ? 'border-zinc-100 opacity-50 grayscale' : 'border-zinc-200 cursor-pointer'} relative flex items-center justify-center p-4`}
      style={{ 
        transformStyle: 'preserve-3d',
        perspective: '1000px'
      }}
    >
      {/* Dice Face Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-2xl" />
      
      {/* Used Overlay */}
      {disabled && !rolling && value > 0 && (
        <div className="absolute inset-0 bg-black/20 rounded-2xl flex items-center justify-center z-20">
          <div className="w-12 h-12 border-4 border-zinc-400 rounded-full flex items-center justify-center">
            <div className="w-6 h-1 bg-zinc-400 rotate-45 absolute" />
            <div className="w-6 h-1 bg-zinc-400 -rotate-45 absolute" />
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-full h-full">
        {dots[value].map((dotIdx) => (
          <div 
            key={dotIdx} 
            className="bg-zinc-900 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] w-full h-full" 
            style={{ gridArea: `${Math.floor(dotIdx / 3) + 1} / ${(dotIdx % 3) + 1}` }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default function LudoGame({ session, user }: LudoGameProps) {
  const gameState = session.state as LudoState;
  const [isRolling, setIsRolling] = useState(false);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [usedDice, setUsedDice] = useState<boolean[]>([false, false]);

  const addLog = (msg: string) => {
    setGameLog(prev => [msg, ...prev].slice(0, 50));
  };

  // AI Turn Logic
  useEffect(() => {
    if (session.isAI && session.currentTurn === 'ai_bot' && gameState.positions['ai_bot']) {
      const triggerAI = async () => {
        if (gameState.canRoll) {
          await new Promise(r => setTimeout(r, 1000));
          await rollDice('ai_bot');
        } else {
          await new Promise(r => setTimeout(r, 1000));
          const diceValues = gameState.diceValues || [0, 0];
          const tokenIdx = await aiService.getLudoMove(gameState.positions['ai_bot'], diceValues, session.difficulty);
          if (tokenIdx !== -1) {
            moveToken(tokenIdx, 'ai_bot');
          }
        }
      };
      triggerAI();
    }
  }, [session.currentTurn, session.isAI, gameState.canRoll]);

  const initializeGame = () => {
    if (session.players[0].id !== user.id) return;

    const positions: Record<string, number[]> = {};
    session.players.forEach(p => {
      positions[p.id] = [-1, -1, -1, -1]; // -1 means in base
    });

    gameService.updateGameState(session.id, {
      positions,
      diceValues: [0, 0],
      canRoll: true
    });
  };

  const rollDice = async (playerId: string = user.id) => {
    if (session.currentTurn !== playerId || !gameState.canRoll) return;

    setIsRolling(true);
    await new Promise(r => setTimeout(r, 600));
    const val1 = Math.floor(Math.random() * 6) + 1;
    const val2 = Math.floor(Math.random() * 6) + 1;
    setIsRolling(false);

    const playerName = session.players.find(p => p.id === playerId)?.name || 'Player';
    addLog(`${playerName} rolled ${val1} and ${val2}`);

    setUsedDice([false, false]);

    const canMoveAny = gameState.positions[playerId].some(pos => 
      (pos === -1 && (val1 === 6 || val2 === 6)) || 
      (pos >= 0 && (pos + val1 <= 57 || pos + val2 <= 57 || pos + val1 + val2 <= 57))
    );

    if (!canMoveAny) {
      // Auto skip if no moves possible
      const nextTurnIndex = (session.players.findIndex(p => p.id === playerId) + 1) % session.players.length;
      gameService.updateGameState(session.id, {
        ...gameState,
        diceValues: [val1, val2],
        canRoll: true
      }, session.players[nextTurnIndex].id);
    } else {
      gameService.updateGameState(session.id, {
        ...gameState,
        diceValues: [val1, val2],
        canRoll: false
      });
    }
  };

  const moveToken = (tokenIndex: number, playerId: string = user.id, dieIdx?: number) => {
    if (session.currentTurn !== playerId || gameState.canRoll) return;

    const currentPos = gameState.positions[playerId][tokenIndex];
    const diceValues = gameState.diceValues || [0, 0];
    
    // If dieIdx is provided, use that specific die. Otherwise try to use sum or first available.
    let moveAmount = 0;
    let usedIndices: number[] = [];

    if (dieIdx !== undefined) {
      if (usedDice[dieIdx]) return;
      moveAmount = diceValues[dieIdx];
      usedIndices = [dieIdx];
    } else {
      // Auto-select logic for simple clicks
      const availableIndices = usedDice.map((u, i) => u ? -1 : i).filter(i => i !== -1);
      if (availableIndices.length === 0) return;
      
      if (currentPos === -1) {
        // Prefer a single 6 to get out
        const sixIdx = availableIndices.find(idx => diceValues[idx] === 6);
        if (sixIdx !== undefined) {
          moveAmount = 6;
          usedIndices = [sixIdx];
        } else {
          return; // No 6 available
        }
      } else {
        // Prefer a single die that makes a valid move
        const validSingleIdx = availableIndices.find(idx => currentPos + diceValues[idx] <= 57);
        if (validSingleIdx !== undefined) {
          moveAmount = diceValues[validSingleIdx];
          usedIndices = [validSingleIdx];
        } else if (availableIndices.length === 2 && currentPos + diceValues[0] + diceValues[1] <= 57) {
          // Use sum if no single die works but sum does
          moveAmount = diceValues[0] + diceValues[1];
          usedIndices = [0, 1];
        } else {
          return; // No valid move
        }
      }
    }

    let newPos = currentPos;
    const playerName = session.players.find(p => p.id === playerId)?.name || 'Player';

    if (currentPos === -1) {
      // Must use a 6 to get out
      const sixIdx = usedIndices.find(i => diceValues[i] === 6);
      if (sixIdx !== undefined) {
        newPos = 0;
        // If we used both dice and one was 6, the other die moves the piece forward from 0
        if (usedIndices.length === 2) {
          const otherDieIdx = usedIndices.find(i => i !== sixIdx)!;
          newPos = diceValues[otherDieIdx];
        }
        addLog(`${playerName} moved Token ${tokenIndex + 1} out of base!`);
      } else {
        return; // Can't get out without a 6
      }
    } else if (currentPos >= 0 && currentPos + moveAmount <= 57) {
      newPos = currentPos + moveAmount;
      addLog(`${playerName} moved Token ${tokenIndex + 1} forward ${moveAmount} steps`);
    } else {
      return; // Invalid move
    }

    // Update used dice
    const newUsedDice = [...usedDice];
    usedIndices.forEach(i => newUsedDice[i] = true);
    setUsedDice(newUsedDice);

    // Immutable update
    const newPositions = { ...gameState.positions };
    newPositions[playerId] = [...newPositions[playerId]];
    newPositions[playerId][tokenIndex] = newPos;

    // Handle capturing
    const globalStep = (newPos + START_STEPS[session.players.findIndex(p => p.id === playerId)]) % 52;
    const isSafe = SAFE_SQUARES.includes(globalStep);

    if (newPos >= 0 && newPos <= 51 && !isSafe) {
      Object.keys(newPositions).forEach(pid => {
        if (pid === playerId) return;
        const opponentIdx = session.players.findIndex(p => p.id === pid);
        newPositions[pid] = newPositions[pid].map(p => {
          if (p === -1 || p >= 52) return p;
          const opponentGlobalStep = (p + START_STEPS[opponentIdx]) % 52;
          return opponentGlobalStep === globalStep ? -1 : p;
        });
      });
    }

    const allDiceUsed = newUsedDice.every(u => u);
    if (allDiceUsed) {
      const hasSix = diceValues.some(v => v === 6);
      const nextTurnIndex = hasSix ? 
        session.players.findIndex(p => p.id === playerId) : 
        (session.players.findIndex(p => p.id === playerId) + 1) % session.players.length;

      gameService.updateGameState(session.id, {
        ...gameState,
        positions: newPositions,
        diceValues: [0, 0],
        canRoll: true
      }, session.players[nextTurnIndex].id);
    } else {
      // Still have dice to use
      gameService.updateGameState(session.id, {
        ...gameState,
        positions: newPositions
      });
    }

    // Check for win
    if (newPositions[playerId].every(p => p === 57)) {
      gameService.completeGame(session.id, playerId);
    }
  };

  if (!gameState.positions || Object.keys(gameState.positions).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-zinc-900 rounded-3xl border border-zinc-800">
        <Dice6 className="w-16 h-16 text-orange-500 mb-6" />
        <h2 className="text-2xl font-bold mb-4">Ludo Session Ready</h2>
        {(session.players[0].id === user.id || session.isLocal || session.isAI) && (
          <Button onClick={initializeGame} size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-12 py-6 text-xl font-bold rounded-2xl">
            Start Game
          </Button>
        )}
      </div>
    );
  }

  const isMyTurn = session.currentTurn === user.id;
  const isLocalTurn = session.isLocal && session.players.some(p => p.id === session.currentTurn);
  const canIPlay = isMyTurn || isLocalTurn;
  const myColor = COLORS[session.players.findIndex(p => p.id === session.currentTurn)];

  const getCoords = (step: number, playerIdx: number) => {
    if (step === -1) return null;
    if (step >= 52) {
      const homeStep = step - 52;
      const coords = HOME_PATHS[playerIdx][homeStep];
      return { col: coords[0], row: coords[1] };
    }
    const globalStep = (step + START_STEPS[playerIdx]) % 52;
    const coords = MAIN_PATH[globalStep];
    return { col: coords[0], row: coords[1] };
  };

  const winner = session.winner ? session.players.find(p => p.id === session.winner) : null;

  return (
    <div className="relative min-h-screen flex flex-col items-center pb-12 px-2 sm:px-4 overflow-x-hidden" style={{ 
      backgroundImage: 'url("https://images.unsplash.com/photo-1588345921523-c2d6c5f10f21?q=80&w=2070&auto=format&fit=crop")',
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      {/* Header */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between px-2 sm:px-4 py-4 sm:py-6 relative z-50">
        <Button 
          variant="ghost" 
          onClick={() => gameService.updateSession(session.id, { status: 'waiting' })}
          className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-full p-2 sm:px-4"
        >
          <ArrowLeft className="w-5 h-5 sm:mr-2" /> <span className="hidden sm:inline">Lobby</span>
        </Button>
        <div className="text-center">
          <h1 className="text-xl sm:text-3xl font-black text-white uppercase tracking-tighter">LUDO <span className="text-teal-500">PRO</span></h1>
        </div>
        <Button 
          variant="ghost" 
          onClick={() => setShowRules(true)}
          className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-full p-2"
        >
          <Info className="w-5 h-5" />
        </Button>
      </div>
      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2rem] w-full max-w-md shadow-2xl"
            >
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                  <Dice6 className="w-6 h-6 text-white" />
                </div>
                NAIJA LUDO SETTINGS
              </h2>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Game Difficulty</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['easy', 'medium', 'hard'].map(d => (
                      <Button 
                        key={d}
                        onClick={() => gameService.updateSession(session.id, { difficulty: d as any })}
                        className={`capitalize font-bold rounded-xl ${session.difficulty === d ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Board Theme</label>
                  <div className="p-4 bg-zinc-800 rounded-2xl border border-zinc-700 flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Classic Wood</span>
                    <Badge className="bg-orange-500">Active</Badge>
                  </div>
                </div>

                <div className="pt-4">
                  <Button onClick={() => setShowSettings(false)} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-6 rounded-2xl shadow-lg shadow-orange-500/20">
                    SAVE & CLOSE
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Toggle Button */}
      <div className="fixed top-24 right-4 z-40 flex flex-col gap-2">
        <button 
          onClick={() => setShowSettings(true)}
          className="w-12 h-12 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-black/60 transition-all shadow-xl"
        >
          <Dice6 className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setShowRules(true)}
          className="w-12 h-12 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-black/60 transition-all shadow-xl"
        >
          <Home className="w-6 h-6" />
        </button>
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
                <Dice6 className="text-orange-500" /> LUDO RULES
              </h2>
              <div className="space-y-4 text-zinc-400 text-sm">
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <p className="text-white font-bold mb-1">Getting Started:</p>
                  <p>You need to roll a <span className="text-orange-500 font-bold">6</span> on either die to move a token out of your base and onto the starting square.</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <p className="text-white font-bold mb-1">Extra Turns:</p>
                  <p>Rolling a 6 gives you an extra roll! This applies to both dice.</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <p className="text-white font-bold mb-1">Safe Zones:</p>
                  <p>Squares marked with a <span className="text-orange-500 font-bold">Star</span> are safe zones. Tokens on these squares cannot be captured by opponents.</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <p className="text-white font-bold mb-1">Winning:</p>
                  <p>Move all 4 tokens to the center home to win the game!</p>
                </div>
              </div>
              <Button onClick={() => setShowRules(false)} className="w-full mt-8 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl">
                GOT IT
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {session.status === 'finished' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-12 rounded-3xl text-center shadow-2xl max-w-sm w-full"
            >
              <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">
                {session.winner === user.id ? "Victory!" : "Game Over"}
              </h2>
              <p className="text-zinc-400 mb-8">
                {session.winner === user.id 
                  ? "All your tokens reached home! You win!" 
                  : `${winner?.name || 'Opponent'} finished all tokens and won the game.`}
              </p>
              <Button onClick={() => window.location.reload()} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-6 rounded-xl">
                Back to Lobby
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scoreboard */}
      <div className="w-full max-w-md mb-4 sm:mb-6 space-y-2 px-4">
        <div className="bg-teal-900/80 backdrop-blur-sm border border-teal-700/50 rounded-xl p-2 sm:p-4 shadow-xl">
          <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2">
            {session.players.map((p, i) => (
              <div key={p.id} className="flex justify-between items-center text-white font-bold text-[10px] sm:text-sm">
                <span className="flex items-center gap-1 sm:gap-2 truncate">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <span className="truncate">{p.name}:</span>
                </span>
                <span>{p.wins || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Professional Ludo Board */}
      <div className="w-full max-w-[700px] aspect-square bg-[#f5e6d3] rounded-2xl border-[12px] border-[#5d4037] p-2 relative grid grid-cols-15 grid-rows-15 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden" style={{
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")',
        backgroundColor: '#f5e6d3'
      }}>
        {/* Decorative Corner Screws */}
        <div className="absolute top-2 left-2 w-4 h-4 bg-zinc-400 rounded-full border-2 border-zinc-600 shadow-inner z-50" />
        <div className="absolute top-2 right-2 w-4 h-4 bg-zinc-400 rounded-full border-2 border-zinc-600 shadow-inner z-50" />
        <div className="absolute bottom-2 left-2 w-4 h-4 bg-zinc-400 rounded-full border-2 border-zinc-600 shadow-inner z-50" />
        <div className="absolute bottom-2 right-2 w-4 h-4 bg-zinc-400 rounded-full border-2 border-zinc-600 shadow-inner z-50" />

        {/* Base Areas */}
        {/* Green (Top Left) */}
        <div className="col-span-6 row-span-6 bg-green-600 p-1 sm:p-4 border-r-2 sm:border-r-4 border-b-2 sm:border-b-4 border-[#5d4037] relative shadow-inner">
          <div className="absolute bottom-0.5 sm:bottom-2 left-1/2 -translate-x-1/2 text-white font-black text-[6px] sm:text-sm drop-shadow-lg uppercase tracking-widest truncate w-full text-center px-1">{session.players[0]?.name || 'Player 1'}</div>
          <div className="w-full h-full bg-white/90 rounded-lg sm:rounded-xl p-1 sm:p-3 grid grid-cols-2 gap-1 sm:gap-3 shadow-2xl">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-green-50 rounded-full border-2 sm:border-4 border-green-600 flex items-center justify-center shadow-inner">
                {gameState.positions[session.players[0]?.id]?.[i] === -1 && (
                  <motion.div 
                    layoutId={`token-0-${i}`}
                    whileHover={{ scale: 1.2 }}
                    onClick={() => canIPlay && session.currentTurn === session.players[0]?.id && moveToken(i, session.players[0]?.id)}
                    className="w-full h-full rounded-full bg-green-600 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.3)] sm:shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)] border sm:border-2 border-white/20 cursor-pointer" 
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Yellow (Top Right) */}
        <div className="col-start-10 col-span-6 row-span-6 bg-yellow-500 p-1 sm:p-4 border-l-2 sm:border-l-4 border-b-2 sm:border-b-4 border-[#5d4037] relative shadow-inner">
          <div className="absolute bottom-0.5 sm:bottom-2 left-1/2 -translate-x-1/2 text-white font-black text-[6px] sm:text-sm drop-shadow-lg uppercase tracking-widest truncate w-full text-center px-1">{session.players[3]?.name || 'Player 4'}</div>
          <div className="w-full h-full bg-white/90 rounded-lg sm:rounded-xl p-1 sm:p-3 grid grid-cols-2 gap-1 sm:gap-3 shadow-2xl">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-yellow-50 rounded-full border-2 sm:border-4 border-yellow-500 flex items-center justify-center shadow-inner">
                {gameState.positions[session.players[3]?.id]?.[i] === -1 && (
                  <motion.div 
                    layoutId={`token-3-${i}`}
                    whileHover={{ scale: 1.2 }}
                    onClick={() => canIPlay && session.currentTurn === session.players[3]?.id && moveToken(i, session.players[3]?.id)}
                    className="w-full h-full rounded-full bg-yellow-500 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.3)] sm:shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)] border sm:border-2 border-white/20 cursor-pointer" 
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Red (Bottom Left) */}
        <div className="col-span-6 row-start-10 row-span-6 bg-red-600 p-1 sm:p-4 border-r-2 sm:border-r-4 border-t-2 sm:border-t-4 border-[#5d4037] relative shadow-inner">
          <div className="absolute top-0.5 sm:top-2 left-1/2 -translate-x-1/2 text-white font-black text-[6px] sm:text-sm drop-shadow-lg uppercase tracking-widest truncate w-full text-center px-1">{session.players[2]?.name || 'Player 3'}</div>
          <div className="w-full h-full bg-white/90 rounded-lg sm:rounded-xl p-1 sm:p-3 grid grid-cols-2 gap-1 sm:gap-3 shadow-2xl">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-red-50 rounded-full border-2 sm:border-4 border-red-600 flex items-center justify-center shadow-inner">
                {gameState.positions[session.players[2]?.id]?.[i] === -1 && (
                  <motion.div 
                    layoutId={`token-2-${i}`}
                    whileHover={{ scale: 1.2 }}
                    onClick={() => canIPlay && session.currentTurn === session.players[2]?.id && moveToken(i, session.players[2]?.id)}
                    className="w-full h-full rounded-full bg-red-600 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.3)] sm:shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)] border sm:border-2 border-white/20 cursor-pointer" 
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Blue (Bottom Right) */}
        <div className="col-start-10 col-span-6 row-start-10 row-span-6 bg-blue-600 p-1 sm:p-4 border-l-2 sm:border-l-4 border-t-2 sm:border-t-4 border-[#5d4037] relative shadow-inner">
          <div className="absolute top-0.5 sm:top-2 left-1/2 -translate-x-1/2 text-white font-black text-[6px] sm:text-sm drop-shadow-lg uppercase tracking-widest truncate w-full text-center px-1">{session.players[1]?.name || 'Player 2'}</div>
          <div className="w-full h-full bg-white/90 rounded-lg sm:rounded-xl p-1 sm:p-3 grid grid-cols-2 gap-1 sm:gap-3 shadow-2xl">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-blue-50 rounded-full border-2 sm:border-4 border-blue-600 flex items-center justify-center shadow-inner">
                {gameState.positions[session.players[1]?.id]?.[i] === -1 && (
                  <motion.div 
                    layoutId={`token-1-${i}`}
                    whileHover={{ scale: 1.2 }}
                    onClick={() => canIPlay && session.currentTurn === session.players[1]?.id && moveToken(i, session.players[1]?.id)}
                    className="w-full h-full rounded-full bg-blue-600 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.3)] sm:shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)] border sm:border-2 border-white/20 cursor-pointer" 
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Path Squares */}
        <div className="absolute inset-0 grid grid-cols-15 grid-rows-15 pointer-events-none">
          {/* Center Home */}
          <div className="col-start-7 row-start-7 col-span-3 row-span-3 bg-zinc-100 border-2 border-zinc-800 flex items-center justify-center overflow-hidden relative">
            <div className="w-full h-full relative">
              <div className="absolute top-0 left-0 w-0 h-0 border-l-[45px] border-l-red-500 border-b-[45px] border-b-transparent border-r-[45px] border-r-transparent" />
              <div className="absolute top-0 right-0 w-0 h-0 border-t-[45px] border-t-blue-500 border-l-[45px] border-l-transparent border-b-[45px] border-b-transparent" />
              <div className="absolute bottom-0 right-0 w-0 h-0 border-r-[45px] border-r-yellow-500 border-t-[45px] border-t-transparent border-l-[45px] border-l-transparent" />
              <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[45px] border-b-green-500 border-r-[45px] border-r-transparent border-t-[45px] border-t-transparent" />
            </div>
            {/* Two Dice in Center */}
            <div className="absolute inset-0 flex items-center justify-center gap-1 sm:gap-4 pointer-events-auto scale-50 sm:scale-100">
              <Dice 
                value={gameState.diceValues?.[0] || 1} 
                rolling={isRolling} 
                onClick={() => rollDice(session.currentTurn)}
                disabled={!canIPlay || (!gameState.canRoll && usedDice[0])}
              />
              <Dice 
                value={gameState.diceValues?.[1] || 1} 
                rolling={isRolling} 
                onClick={() => rollDice(session.currentTurn)}
                disabled={!canIPlay || (!gameState.canRoll && usedDice[1])}
              />
            </div>
          </div>

          {/* Path Grids with Arrows and Stars */}
          <div className="col-start-7 row-start-1 col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 border-x-2 border-zinc-800">
            {Array.from({ length: 18 }).map((_, i) => {
              const row = Math.floor(i / 3);
              const col = i % 3;
              const globalIdx = (row * 3 + col);
              // Map local grid to global path if possible or just use coordinates
              const isStar = (row === 1 && col === 0) || (row === 4 && col === 2);
              return (
                <div key={i} className={`border border-zinc-300 flex items-center justify-center ${col === 1 && row > 0 ? 'bg-green-100' : ''}`}>
                  {row === 0 && col === 1 && <span className="text-zinc-400 text-xs font-bold">↓</span>}
                  {isStar && <Flag className="w-3 h-3 text-zinc-400 opacity-50" />}
                </div>
              );
            })}
          </div>
          <div className="col-start-1 row-start-7 col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 border-y-2 border-zinc-800">
            {Array.from({ length: 18 }).map((_, i) => {
              const row = Math.floor(i / 6);
              const col = i % 6;
              const isStar = (row === 0 && col === 1) || (row === 2 && col === 4);
              return (
                <div key={i} className={`border border-zinc-300 flex items-center justify-center ${row === 1 && col > 0 ? 'bg-yellow-100' : ''}`}>
                  {row === 1 && col === 0 && <span className="text-zinc-400 text-xs font-bold">→</span>}
                  {isStar && <Flag className="w-3 h-3 text-zinc-400 opacity-50" />}
                </div>
              );
            })}
          </div>
          <div className="col-start-10 row-start-7 col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 border-y-2 border-zinc-800">
            {Array.from({ length: 18 }).map((_, i) => {
              const row = Math.floor(i / 6);
              const col = i % 6;
              const isStar = (row === 0 && col === 1) || (row === 2 && col === 4);
              return (
                <div key={i} className={`border border-zinc-300 flex items-center justify-center ${row === 1 && col < 5 ? 'bg-blue-100' : ''}`}>
                  {row === 1 && col === 5 && <span className="text-zinc-400 text-xs font-bold">←</span>}
                  {isStar && <Flag className="w-3 h-3 text-zinc-400 opacity-50" />}
                </div>
              );
            })}
          </div>
          <div className="col-start-7 row-start-10 col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 border-x-2 border-zinc-800">
            {Array.from({ length: 18 }).map((_, i) => {
              const row = Math.floor(i / 3);
              const col = i % 3;
              const isStar = (row === 1 && col === 0) || (row === 4 && col === 2);
              return (
                <div key={i} className={`border border-zinc-300 flex items-center justify-center ${col === 1 && row < 5 ? 'bg-red-100' : ''}`}>
                  {row === 5 && col === 1 && <span className="text-zinc-400 text-xs font-bold">↑</span>}
                  {isStar && <Flag className="w-3 h-3 text-zinc-400 opacity-50" />}
                </div>
              );
            })}
          </div>

          {/* Tokens on Path */}
          {Object.entries(gameState.positions).map(([pid, tokens]) => {
            const playerIdx = session.players.findIndex(p => p.id === pid);
            return tokens.map((pos, i) => {
              if (pos === -1 || pos === 57) return null;
              const coords = getCoords(pos, playerIdx);
              if (!coords) return null;
              
              const isCurrentTurnToken = session.currentTurn === pid;
              
              return (
                <motion.div
                  key={`${pid}-${i}`}
                  layoutId={`token-${playerIdx}-${i}`}
                  onClick={() => canIPlay && isCurrentTurnToken && moveToken(i, pid)}
                  animate={isCurrentTurnToken && !gameState.canRoll ? { scale: [1, 1.2, 1], y: [0, -5, 0] } : { scale: 1, y: 0 }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className={`absolute w-8 h-8 rounded-full border-2 border-white/50 shadow-xl z-30 flex items-center justify-center cursor-pointer ${isCurrentTurnToken ? 'ring-4 ring-white/30' : ''}`}
                  style={{
                    backgroundColor: COLORS[playerIdx],
                    gridColumnStart: coords.col + 1,
                    gridRowStart: coords.row + 1,
                    width: '100%',
                    height: '100%',
                    padding: '15%'
                  }}
                >
                  <div className="w-full h-full rounded-full bg-white/20 border border-white/10" />
                </motion.div>
              );
            });
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-8 flex flex-col items-center gap-6 w-full max-w-md">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-500 border-4 border-white flex items-center justify-center text-white font-black text-xl shadow-lg">0</div>
          <div className="w-16 h-16 rounded-full bg-red-500 border-4 border-white flex items-center justify-center text-white font-black text-xl shadow-lg">0</div>
          <div className="w-16 h-16 rounded-full bg-green-500 border-4 border-white flex items-center justify-center text-white font-black text-xl shadow-lg">0</div>
        </div>

        <div className="w-full bg-teal-900/90 backdrop-blur-md rounded-2xl py-4 px-8 border-2 border-teal-700/50 shadow-2xl text-center">
          <h3 className="text-white font-black text-2xl uppercase tracking-widest">
            {canIPlay ? 'Your Turn' : `${session.players.find(p => p.id === session.currentTurn)?.name}'s Turn`}
          </h3>
          {canIPlay && gameState.canRoll && (
            <p className="text-orange-400 text-xs font-bold mt-1 animate-pulse uppercase">Tap the dice to roll!</p>
          )}
        </div>

        {/* Game Log / Account */}
        <div className="w-full bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 h-40 overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Game Account</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="space-y-1">
            {gameLog.map((log, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={i} 
                className="text-xs text-zinc-300 font-medium border-l-2 border-orange-500/30 pl-2 py-1"
              >
                {log}
              </motion.div>
            ))}
            {gameLog.length === 0 && (
              <p className="text-zinc-600 text-xs italic text-center mt-8">Game started. Waiting for moves...</p>
            )}
          </div>
        </div>
      </div>

      {/* Token Selection (Side Panel) */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 space-y-4 hidden lg:block">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full">Tokens</h3>
        <div className="flex flex-col gap-3">
          {gameState.positions[session.currentTurn]?.map((pos, i) => (
            <Button
              key={i}
              onClick={() => moveToken(i, session.currentTurn)}
              disabled={!canIPlay || gameState.canRoll}
              className={`w-20 h-20 flex flex-col items-center justify-center gap-2 rounded-2xl border-4 transition-all relative overflow-hidden ${pos === -1 ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-800 border-orange-500/50 shadow-lg'}`}
            >
              <motion.div 
                animate={pos !== -1 && !gameState.canRoll ? { scale: [1, 1.2, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-6 h-6 rounded-full border-2 border-white/20" 
                style={{ backgroundColor: myColor }} 
              />
              <div className="text-[8px] uppercase font-black text-zinc-500">T{i+1}</div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
