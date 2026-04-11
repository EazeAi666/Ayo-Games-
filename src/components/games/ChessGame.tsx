import { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { motion, AnimatePresence } from 'motion/react';
import { GameSession, Player } from '../../types';
import { gameService } from '../../services/gameService';
import { aiService } from '../../services/aiService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Undo2, Lightbulb, BrainCircuit, Trophy, ArrowLeft, Info } from 'lucide-react';

interface ChessGameProps {
  session: GameSession;
  user: Player;
}

export default function ChessGame({ session, user }: ChessGameProps) {
  const [gameData, setGameData] = useState({
    game: new Chess(session.state.fen === 'start' ? undefined : session.state.fen),
    history: (session.state.history || []) as string[]
  });
  const [isThinking, setIsThinking] = useState(false);
  const [tutorMove, setTutorMove] = useState<{ from: string; to: string } | null>(null);
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  const [coachMessage, setCoachMessage] = useState<string>("Welcome! I'm here to help you improve your game. Let's start!");
  const [isCoachThinking, setIsCoachThinking] = useState(false);
  const [activeTab, setActiveTab] = useState<'play' | 'train' | 'lessons' | 'home'>('play');
  const [boardTheme, setBoardTheme] = useState({
    dark: '#4b5320',
    light: '#d2b48c'
  });
  const [moveSquares, setMoveSquares] = useState<Record<string, any>>({});
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [lastMoveSquares, setLastMoveSquares] = useState<Record<string, any>>({});
  const [capturedPieces, setCapturedPieces] = useState<{ white: string[]; black: string[] }>({ white: [], black: [] });
  const [showPromotionDialog, setShowPromotionDialog] = useState<{ from: string; to: string } | null>(null);
  const [timers, setTimers] = useState<{ white: number; black: number }>({ white: 600, black: 600 }); // 10 mins each

  const themes = [
    { name: 'Classic', dark: '#4b5320', light: '#d2b48c' },
    { name: 'Modern', dark: '#4b7399', light: '#dee3e6' },
    { name: 'Tournament', dark: '#769656', light: '#eeeed2' },
    { name: 'Dark', dark: '#2e2e2e', light: '#4a4a4a' },
    { name: 'Ayo Black Red', dark: '#7f1d1d', light: '#18181b' }
  ];

  useEffect(() => {
    if (session.status === 'playing' && gameData.history.length === 0) {
      setIsCoachThinking(true);
      aiService.getChessAdvice(gameData.game.fen(), [], "Game Start").then(advice => {
        setCoachMessage(advice);
        setIsCoachThinking(false);
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = gameService.subscribe(session.id, (updatedSession) => {
      setGameData(prev => {
        const currentFen = prev.game.fen();
        const incomingFen = updatedSession.state.fen === 'start' 
          ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" 
          : updatedSession.state.fen;
          
        if (incomingFen !== currentFen) {
          return {
            game: new Chess(updatedSession.state.fen === 'start' ? undefined : updatedSession.state.fen),
            history: updatedSession.state.history || []
          };
        }
        return prev;
      });
    });
    return unsubscribe;
  }, [session.id]);

  // Timer Logic
  useEffect(() => {
    if (session.status !== 'playing') return;
    const interval = setInterval(() => {
      setTimers(prev => {
        const turn = gameData.game.turn() === 'w' ? 'white' : 'black';
        if (prev[turn] <= 0) {
          gameService.completeGame(session.id, turn === 'white' ? session.players[1].id : session.players[0].id);
          return prev;
        }
        return { ...prev, [turn]: prev[turn] - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [session.status, gameData.game.turn()]);

  // AI Turn Logic
  useEffect(() => {
    if (session.isAI && session.currentTurn === 'ai_bot' && !gameData.game.isGameOver()) {
      const triggerAI = async () => {
        setIsThinking(true);
        try {
          await new Promise(r => setTimeout(r, 1000));
          const move = await aiService.getChessMove(gameData.game.fen(), gameData.history, session.difficulty);
          if (move) {
            makeAMove(move);
          } else {
            const moves = gameData.game.moves();
            if (moves.length > 0) {
              makeAMove(moves[Math.floor(Math.random() * moves.length)]);
            }
          }
        } catch (error) {
          console.error("AI Turn Error:", error);
        } finally {
          setIsThinking(false);
        }
      };
      triggerAI();
    }
  }, [session.currentTurn, session.isAI, gameData.game.fen()]);

  const getTutorSuggestion = async () => {
    if (isTutorLoading) return;
    setIsTutorLoading(true);
    try {
      const moveSan = await aiService.getChessMove(gameData.game.fen(), gameData.history, 'very_hard');
      if (moveSan) {
        const tempGame = new Chess(gameData.game.fen());
        const moveObj = tempGame.move(moveSan);
        if (moveObj) {
          setTutorMove({ from: moveObj.from, to: moveObj.to });
          setTimeout(() => setTutorMove(null), 3000); // Clear after 3s
        }
      }
    } finally {
      setIsTutorLoading(false);
    }
  };

  const undoLastMove = () => {
    if (gameData.history.length === 0) return;
    
    const gameCopy = new Chess(gameData.game.fen());
    const move1 = gameCopy.undo();
    if (!move1) return;
    
    // If AI game, undo twice to get back to user's turn
    if (session.isAI && session.currentTurn === user.id) {
      gameCopy.undo();
    }

    const newFen = gameCopy.fen();
    const newHistory = gameData.history.slice(0, (session.isAI && session.currentTurn === user.id) ? -2 : -1);

    setGameData({
      game: new Chess(newFen),
      history: newHistory
    });

    gameService.updateGameState(session.id, {
      fen: newFen,
      history: newHistory
    }, user.id);
  };

  const makeAMove = useCallback(
    (move: any) => {
      try {
        const gameCopy = new Chess(gameData.game.fen());
        const result = gameCopy.move(move);
        
        if (result) {
          const newFen = gameCopy.fen();
          const newHistory = [...gameData.history, result.san];
          
          // Update captured pieces
          if (result.captured) {
            const piece = result.captured.toUpperCase();
            const color = result.color === 'w' ? 'black' : 'white';
            setCapturedPieces(prev => ({
              ...prev,
              [color]: [...prev[color], piece]
            }));
          }

          setGameData({
            game: new Chess(newFen),
            history: newHistory
          });

          setLastMoveSquares({
            [result.from]: { backgroundColor: 'rgba(255, 255, 0, 0.2)' },
            [result.to]: { backgroundColor: 'rgba(255, 255, 0, 0.2)' }
          });
          
          // Determine next turn
          const currentPlayerIndex = session.players.findIndex(p => p.id === session.currentTurn);
          const nextPlayerIndex = (currentPlayerIndex + 1) % session.players.length;
          const nextTurn = session.players[nextPlayerIndex].id;
          
          // Update game state in service
          gameService.updateGameState(session.id, {
            fen: newFen,
            history: newHistory
          }, nextTurn);

          // Check for game over
          if (gameCopy.isGameOver()) {
            let winnerId = 'draw';
            if (gameCopy.isCheckmate()) {
              winnerId = session.currentTurn;
            }
            gameService.completeGame(session.id, winnerId);
          }

          // Get Coach Advice
          if (session.isAI) {
            setIsCoachThinking(true);
            aiService.getChessAdvice(newFen, newHistory, result.san).then(advice => {
              setCoachMessage(advice);
              setIsCoachThinking(false);
            });
          }
          
          return true;
        }
      } catch (e) {
        console.error("Move error:", e);
        return false;
      }
      return false;
    },
    [gameData.game, gameData.history, session.id, session.players, session.currentTurn]
  );

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (session.status !== 'playing') return false;
    
    if (!session.isLocal && session.currentTurn !== user.id) return false;

    // Check for promotion
    const piece = gameData.game.get(sourceSquare as any);
    if (piece?.type === 'p' && ((piece.color === 'w' && targetSquare[1] === '8') || (piece.color === 'b' && targetSquare[1] === '1'))) {
      setShowPromotionDialog({ from: sourceSquare, to: targetSquare });
      return true;
    }

    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    return move;
  }

  const handlePromotion = (piece: string) => {
    if (!showPromotionDialog) return;
    makeAMove({
      from: showPromotionDialog.from,
      to: showPromotionDialog.to,
      promotion: piece.toLowerCase(),
    });
    setShowPromotionDialog(null);
  };

  const onSquareClick = (square: string) => {
    if (session.status !== 'playing') return;
    if (!session.isLocal && session.currentTurn !== user.id) return;

    // If a square is already selected, try to move there
    const selectedSquare = Object.keys(moveSquares).find(s => moveSquares[s].backgroundColor === 'rgba(255, 255, 0, 0.4)');
    
    if (selectedSquare) {
      const move = makeAMove({
        from: selectedSquare,
        to: square,
        promotion: 'q'
      });
      if (move) {
        setMoveSquares({});
        return;
      }
    }

    // Otherwise, show possible moves for the clicked square
    const moves = gameData.game.moves({
      square: square as any,
      verbose: true
    });

    if (moves.length === 0) {
      setMoveSquares({});
      return;
    }

    const newSquares: Record<string, any> = {
      [square]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
    };
    moves.forEach((m) => {
      newSquares[m.to] = {
        background: 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%'
      };
    });
    setMoveSquares(newSquares);
  };

  const isMyTurn = session.currentTurn === user.id;
  const currentPlayer = session.players.find(p => p.id === session.currentTurn);
  const opponent = session.players.find(p => p.id !== user.id);

  const winner = session.winner ? session.players.find(p => p.id === session.winner) : null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPieceIcon = (piece: string, color: 'white' | 'black') => {
    const icons: Record<string, string> = {
      P: '♟', R: '♜', N: '♞', B: '♝', Q: '♛', K: '♚'
    };
    return icons[piece] || piece;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f4ece4] text-zinc-900 font-serif">
      {/* Header */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between px-4 py-6">
        <Button 
          variant="ghost" 
          onClick={() => gameService.updateSession(session.id, { status: 'waiting' })}
          className="text-[#5d4037] hover:bg-[#5d4037]/10 rounded-full"
        >
          <ArrowLeft className="w-5 h-5 mr-2" /> Lobby
        </Button>
        <div className="text-center">
          <h1 className="text-3xl font-black text-[#2e1a16] uppercase tracking-tighter">CHESS <span className="text-[#5d4037]">MASTER</span></h1>
        </div>
        <Button 
          variant="ghost" 
          onClick={() => setShowRules(true)}
          className="text-[#5d4037] hover:bg-[#5d4037]/10 rounded-full"
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
              className="bg-white border-4 border-[#5d4037] p-8 rounded-3xl max-w-lg w-full shadow-2xl overflow-y-auto max-h-[80vh]"
            >
              <h2 className="text-2xl font-black text-[#2e1a16] mb-6 flex items-center gap-3">
                <Info className="text-orange-500" /> CHESS RULES
              </h2>
              <div className="space-y-4 text-[#5d4037] text-sm">
                <div className="p-4 bg-[#f4ece4] rounded-xl border border-[#5d4037]/20">
                  <p className="text-[#2e1a16] font-bold mb-1">Objective:</p>
                  <p>Checkmate the opponent's King by placing it under attack such that it has no legal moves to escape.</p>
                </div>
                <div className="p-4 bg-[#f4ece4] rounded-xl border border-[#5d4037]/20">
                  <p className="text-[#2e1a16] font-bold mb-1">Special Moves:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><span className="font-bold">Castling:</span> Move King two squares towards a Rook, and the Rook moves to the square the King skipped.</li>
                    <li><span className="font-bold">En Passant:</span> A special pawn capture that can only occur immediately after a pawn makes a double-step move.</li>
                    <li><span className="font-bold">Promotion:</span> When a pawn reaches the 8th rank, it can be promoted to a Queen, Rook, Bishop, or Knight.</li>
                  </ul>
                </div>
              </div>
              <Button onClick={() => setShowRules(false)} className="w-full mt-8 bg-[#5d4037] hover:bg-[#2e1a16] text-white font-bold py-4 rounded-xl">
                GOT IT
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dr. Wolf Coach Section */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-8 pb-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-start gap-4 w-full">
            <div className="flex-shrink-0">
              <div className="w-24 h-32 rounded-xl bg-[#d2b48c] border-2 border-[#5d4037] overflow-hidden shadow-lg">
                <img 
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=Wolf&backgroundColor=ffdfbf&mouth=smile&top=shortHair&hairColor=705c53" 
                  alt="Coach Wolf"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            <div className="flex-1 relative">
              <div className="bg-white p-6 rounded-2xl border-2 border-[#5d4037] shadow-md relative after:content-[''] after:absolute after:top-6 after:-left-3 after:w-6 after:h-6 after:bg-white after:border-l-2 after:border-b-2 after:border-[#5d4037] after:rotate-45">
                <p className="text-lg md:text-xl text-[#2e1a16] italic leading-relaxed font-medium">
                  {isCoachThinking ? "Thinking..." : coachMessage}
                </p>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setCoachMessage("I'm here to help! Ask me anything about the position.")}
                  className="w-12 h-12 rounded-xl border-2 border-[#5d4037] bg-white hover:bg-[#f4ece4] text-[#5d4037]"
                >
                  <span className="text-xl font-bold">?</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={undoLastMove}
                  disabled={gameData.history.length === 0 || isThinking}
                  className="w-12 h-12 rounded-xl border-2 border-[#5d4037] bg-white hover:bg-[#f4ece4] text-[#5d4037]"
                >
                  <Undo2 className="w-6 h-6" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowThemeMenu(!showThemeMenu)}
                  className="w-12 h-12 rounded-xl border-2 border-[#5d4037] bg-white hover:bg-[#f4ece4] text-[#5d4037] relative"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="w-1 h-1 bg-[#5d4037] rounded-full" />
                    <div className="w-1 h-1 bg-[#5d4037] rounded-full" />
                    <div className="w-1 h-1 bg-[#5d4037] rounded-full" />
                  </div>
                </Button>

                <AnimatePresence>
                  {showThemeMenu && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute top-full right-0 mt-2 w-48 bg-white border-2 border-[#5d4037] rounded-2xl shadow-xl z-[60] overflow-hidden"
                    >
                      <div className="p-3 border-b border-[#5d4037]/10 bg-[#f4ece4]/50">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#5d4037]">Board Themes</p>
                      </div>
                      <div className="p-2 space-y-1">
                        {themes.map((t) => (
                          <button
                            key={t.name}
                            onClick={() => {
                              setBoardTheme({ dark: t.dark, light: t.light });
                              setShowThemeMenu(false);
                            }}
                            className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors ${boardTheme.dark === t.dark ? 'bg-[#5d4037] text-white' : 'hover:bg-[#f4ece4] text-[#5d4037]'}`}
                          >
                            <div className="flex w-6 h-6 rounded overflow-hidden border border-black/10">
                              <div className="w-1/2 h-full" style={{ backgroundColor: t.light }} />
                              <div className="w-1/2 h-full" style={{ backgroundColor: t.dark }} />
                            </div>
                            <span className="text-xs font-bold">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24">
        {/* Game Over Overlay */}
        <AnimatePresence>
          {session.status === 'finished' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white border-4 border-[#5d4037] p-12 rounded-[2rem] text-center shadow-2xl max-w-sm w-full"
              >
                <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20">
                  <Trophy className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-black text-[#2e1a16] mb-2">
                  {session.winner === 'draw' ? "It's a Draw!" : session.winner === user.id ? "Victory!" : "Defeat"}
                </h2>
                <p className="text-[#5d4037] mb-8 font-medium">
                  {session.winner === 'draw' 
                    ? "A hard-fought battle with no clear winner." 
                    : session.winner === user.id 
                      ? "Congratulations! You outsmarted your opponent." 
                      : `Better luck next time. ${winner?.name || 'Opponent'} won.`}
                </p>
                <Button onClick={() => window.location.reload()} className="w-full bg-[#5d4037] hover:bg-[#2e1a16] text-white font-black py-6 rounded-2xl shadow-xl">
                  Back to Lobby
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center">
          {/* Opponent Info */}
          <div className="w-full flex items-center justify-between mb-4 bg-white/50 p-3 rounded-xl border border-[#5d4037]/20">
            <div className="flex items-center gap-3">
              <img src={opponent?.avatar} className="w-10 h-10 rounded-full border-2 border-[#5d4037]" alt={opponent?.name} />
              <div>
                <p className="text-sm font-black text-[#2e1a16]">{opponent?.name}</p>
                <div className="flex gap-1">
                  {capturedPieces[gameData.game.turn() === 'w' ? 'black' : 'white'].map((p, i) => (
                    <span key={i} className="text-xs text-[#5d4037]">{getPieceIcon(p, 'black')}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className={`px-4 py-1 rounded-lg font-mono font-bold text-xl ${gameData.game.turn() === (session.players[0].color === 'black' ? 'w' : 'b') ? 'bg-[#5d4037] text-white' : 'bg-zinc-200 text-zinc-500'}`}>
              {formatTime(timers[session.players[0].color === 'black' ? 'white' : 'black'])}
            </div>
          </div>

          <div className="w-full aspect-square bg-[#d2b48c] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-8 border-[#5d4037] p-1 relative">
            {/* Promotion Dialog */}
            <AnimatePresence>
              {showPromotionDialog && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                >
                  <div className="bg-white p-6 rounded-2xl border-4 border-[#5d4037] shadow-2xl flex gap-4">
                    {['Q', 'R', 'B', 'N'].map(p => (
                      <button 
                        key={p} onClick={() => handlePromotion(p)}
                        className="w-16 h-16 bg-[#f4ece4] hover:bg-[#d2b48c] rounded-xl border-2 border-[#5d4037] text-4xl flex items-center justify-center transition-all"
                      >
                        {getPieceIcon(p, 'white')}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div key={gameData.game.fen()} className="w-full h-full">
              {activeTab === 'play' ? (
                <Chessboard 
                  // @ts-ignore
                  position={gameData.game.fen()} 
                  onPieceDrop={onDrop} 
                  onSquareClick={onSquareClick}
                  boardOrientation={session.players[0]?.color === 'black' ? 'black' : 'white'}
                  customDarkSquareStyle={{ backgroundColor: boardTheme.dark }}
                  customLightSquareStyle={{ backgroundColor: boardTheme.light }}
                  customSquareStyles={{
                    ...moveSquares,
                    ...lastMoveSquares,
                    ...(tutorMove ? {
                      [tutorMove.from]: { backgroundColor: 'rgba(34, 197, 94, 0.4)' },
                      [tutorMove.to]: { backgroundColor: 'rgba(34, 197, 94, 0.6)' }
                    } : {})
                  }}
                  animationDuration={300}
                />
              ) : activeTab === 'train' ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white/80 backdrop-blur-sm">
                  <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
                    <BrainCircuit className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-black text-[#2e1a16] mb-4">Tactics Puzzles</h3>
                  <p className="text-[#5d4037] mb-8">Sharpen your mind with over 350,000 challenges. Solve puzzles to earn points and level up!</p>
                  <Button className="bg-[#5d4037] hover:bg-[#2e1a16] text-white font-bold px-8 py-6 rounded-xl">
                    Start Solving
                  </Button>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white/80 backdrop-blur-sm">
                  <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-black text-[#2e1a16] mb-4">Interactive Lessons</h3>
                  <p className="text-[#5d4037] mb-8">Master openings, middlegames, and endgames with step-by-step guidance from Coach Wolf.</p>
                  <Button className="bg-[#5d4037] hover:bg-[#2e1a16] text-white font-bold px-8 py-6 rounded-xl">
                    View Lessons
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* User Info */}
          <div className="w-full flex items-center justify-between mt-4 bg-white p-3 rounded-xl border-2 border-[#5d4037] shadow-md">
            <div className="flex items-center gap-3">
              <img src={user.avatar} className="w-10 h-10 rounded-full border-2 border-[#5d4037]" alt={user.name} />
              <div>
                <p className="text-sm font-black text-[#2e1a16]">{user.name} (You)</p>
                <div className="flex gap-1">
                  {capturedPieces[gameData.game.turn() === 'w' ? 'white' : 'black'].map((p, i) => (
                    <span key={i} className="text-xs text-[#5d4037]">{getPieceIcon(p, 'white')}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className={`px-4 py-1 rounded-lg font-mono font-bold text-xl ${gameData.game.turn() === (session.players[0].color === 'white' ? 'w' : 'b') ? 'bg-[#5d4037] text-white' : 'bg-zinc-200 text-zinc-500'}`}>
              {formatTime(timers[session.players[0].color === 'white' ? 'white' : 'black'])}
            </div>
          </div>

          {/* Move History */}
          <div className="mt-6 w-full">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5d4037] mb-2">Move History</p>
            <ScrollArea className="h-24 w-full bg-white/50 rounded-xl border border-[#5d4037]/20 p-3">
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: Math.ceil(gameData.history.length / 2) }).map((_, i) => (
                  <div key={i} className="flex gap-2 text-xs font-bold">
                    <span className="text-[#5d4037]/40 w-4">{i + 1}.</span>
                    <span className="text-[#2e1a16]">{gameData.history[i * 2]}</span>
                    <span className="text-[#2e1a16]">{gameData.history[i * 2 + 1]}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[#5d4037]/10 px-6 py-3 z-50">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-orange-500' : 'text-zinc-400'}`}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </div>
            <span className="text-[10px] font-bold uppercase">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('play')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'play' ? 'text-orange-500' : 'text-zinc-400'}`}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
            </div>
            <span className="text-[10px] font-bold uppercase">Play</span>
          </button>
          <button 
            onClick={() => setActiveTab('train')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'train' ? 'text-orange-500' : 'text-zinc-400'}`}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>
            </div>
            <span className="text-[10px] font-bold uppercase">Train</span>
          </button>
          <button 
            onClick={() => setActiveTab('lessons')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'lessons' ? 'text-orange-500' : 'text-zinc-400'}`}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>
            </div>
            <span className="text-[10px] font-bold uppercase">Lessons</span>
          </button>
        </div>
      </div>
    </div>
  );
}
