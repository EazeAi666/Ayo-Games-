import { useState, useEffect } from 'react';
import { GameSession, Player, WhotState } from '../../types';
import { gameService } from '../../services/gameService';
import { aiService } from '../../services/aiService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, User, AlertCircle, Trophy, ArrowLeft, Info } from 'lucide-react';

interface WhotGameProps {
  session: GameSession;
  user: Player;
}

const SUITS = ['circles', 'triangles', 'crosses', 'squares', 'stars'];

const CardShape = ({ suit, className }: { suit: string; className?: string }) => {
  switch (suit) {
    case 'circles':
      return <div className={`rounded-full border-4 border-current ${className}`} style={{ width: '100%', height: '100%' }} />;
    case 'triangles':
      return (
        <svg viewBox="0 0 24 24" className={`fill-none stroke-current stroke-[3] ${className}`} style={{ width: '100%', height: '100%' }}>
          <path d="M12 3L2 20H22L12 3Z" />
        </svg>
      );
    case 'crosses':
      return (
        <svg viewBox="0 0 24 24" className={`fill-none stroke-current stroke-[4] ${className}`} style={{ width: '100%', height: '100%' }}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      );
    case 'squares':
      return <div className={`border-4 border-current ${className}`} style={{ width: '100%', height: '100%' }} />;
    case 'stars':
      return (
        <svg viewBox="0 0 24 24" className={`fill-current ${className}`} style={{ width: '100%', height: '100%' }}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    case 'whot':
      return (
        <div className={`flex items-center justify-center font-black text-2xl italic ${className}`}>
          WHOT
        </div>
      );
    default:
      return null;
  }
};

const WhotCardUI = ({ card, onClick, disabled, size = 'md' }: { card: string; onClick?: () => void; disabled?: boolean; size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const [suit, num] = card.split('-');
  
  const sizeClasses = {
    sm: 'w-16 h-24',
    md: 'w-24 h-36',
    lg: 'w-32 h-48',
    xl: 'w-40 h-60'
  };

  const suitColors: Record<string, string> = {
    circles: 'text-blue-600',
    triangles: 'text-red-600',
    crosses: 'text-green-600',
    squares: 'text-orange-600',
    stars: 'text-purple-600',
    whot: 'text-zinc-900'
  };

  return (
    <motion.div
      whileHover={!disabled && onClick ? { y: -10, scale: 1.05, rotate: 2 } : {}}
      onClick={!disabled ? onClick : undefined}
      className={`${sizeClasses[size]} bg-white rounded-xl border-2 border-zinc-200 shadow-lg flex flex-col relative overflow-hidden p-2 select-none ${disabled ? 'opacity-50 grayscale' : 'cursor-pointer'} transition-shadow hover:shadow-2xl`}
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, #ffffff 0%, #f8f8f8 100%)'
      }}
    >
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
      
      {/* Corner Numbers */}
      <div className={`absolute top-1 left-1 font-black leading-none ${suitColors[suit]} ${size === 'sm' ? 'text-xs' : 'text-base'}`}>
        {num}
      </div>
      <div className={`absolute bottom-1 right-1 font-black leading-none rotate-180 ${suitColors[suit]} ${size === 'sm' ? 'text-xs' : 'text-base'}`}>
        {num}
      </div>

      {/* Center Shape */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className={`w-full h-full max-w-[70%] max-h-[70%] ${suitColors[suit]} drop-shadow-md`}>
          <CardShape suit={suit} />
        </div>
      </div>

      {/* Decorative Pattern */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none flex flex-wrap gap-1 p-1">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="w-3 h-3">
            <CardShape suit={suit} />
          </div>
        ))}
      </div>
      
      {/* Card Border Inner */}
      <div className={`absolute inset-1 border border-zinc-100 rounded-lg pointer-events-none`} />
    </motion.div>
  );
};

export default function WhotGame({ session, user }: WhotGameProps) {
  const gameState = session.state as WhotState;
  const [isThinking, setIsThinking] = useState(false);
  const [showSuitSelector, setShowSuitSelector] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // AI Turn Logic
  useEffect(() => {
    if (session.isAI && session.currentTurn === 'ai_bot' && gameState.discardPile?.length > 0) {
      const triggerAI = async () => {
        setIsThinking(true);
        await new Promise(r => setTimeout(r, 1500));
        
        const myHand = gameState.playerHands['ai_bot'] || [];
        const topCard = gameState.discardPile[gameState.discardPile.length - 1];
        const move = await aiService.getWhotMove(myHand, topCard, gameState.currentSuit || '', session.difficulty);
        
        if (move === 'DRAW' || !myHand.includes(move)) {
          drawCard('ai_bot');
        } else {
          const [suit] = move.split('-');
          if (suit === 'whot') {
            // AI picks a suit it has most of
            const suitCounts: Record<string, number> = {};
            myHand.forEach(c => {
              const [s] = c.split('-');
              if (s !== 'whot') suitCounts[s] = (suitCounts[s] || 0) + 1;
            });
            const bestSuit = Object.keys(suitCounts).sort((a, b) => suitCounts[b] - suitCounts[a])[0] || SUITS[0];
            playCard(move, 'ai_bot', bestSuit);
          } else {
            playCard(move, 'ai_bot');
          }
        }
        setIsThinking(false);
      };
      triggerAI();
    }
  }, [session.currentTurn, session.isAI, gameState.discardPile?.length]);

  const initializeGame = () => {
    if (session.players[0].id !== user.id) return; // Only host can init

    const deck: string[] = [];
    SUITS.forEach(suit => {
      [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14].forEach(num => {
        deck.push(`${suit}-${num}`);
      });
    });
    for (let i = 0; i < 4; i++) deck.push(`whot-20`);

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const playerHands: Record<string, string[]> = {};
    session.players.forEach(p => {
      playerHands[p.id] = deck.splice(0, 5);
    });

    const firstCard = deck.pop()!;
    const discardPile = [firstCard];

    gameService.updateGameState(session.id, {
      deck,
      discardPile,
      playerHands,
      currentSuit: firstCard.split('-')[0]
    });
  };

  const playCard = (card: string, playerId: string = user.id, requestedSuit?: string) => {
    if (session.currentTurn !== playerId) return;

    const [suit, numStr] = card.split('-');
    const num = parseInt(numStr);
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    const [topSuit, topNumStr] = topCard.split('-');
    const topNum = parseInt(topNumStr);

    // Defense logic: If there's a penalty, you MUST play a card of the same number or a Whot card
    const currentPenalty = gameState.penalty || 0;
    if (currentPenalty > 0) {
      const canDefend = num === topNum || suit === 'whot';
      if (!canDefend) return;
    }

    const canPlay = suit === 'whot' || suit === gameState.currentSuit || num === topNum;

    if (!canPlay) return;

    // If it's a Whot card and no suit requested yet, show selector
    if (suit === 'whot' && !requestedSuit && playerId === user.id) {
      setShowSuitSelector(true);
      // We don't update state yet, wait for suit selection
      return;
    }

    const newHand = gameState.playerHands[playerId].filter(c => c !== card);
    const newDiscard = [...gameState.discardPile, card];
    
    let nextTurnIndex = (session.players.findIndex(p => p.id === playerId) + 1) % session.players.length;
    let newDeck = [...gameState.deck];
    let newPlayerHands = { ...gameState.playerHands, [playerId]: newHand };
    let newPenalty = gameState.penalty || 0;

    // Handle special cards
    if (num === 1) {
      // Hold on - player plays again
      nextTurnIndex = session.players.findIndex(p => p.id === playerId);
    } else if (num === 8) {
      // Suspension - skip next player
      nextTurnIndex = (nextTurnIndex + 1) % session.players.length;
    } else if (num === 2) {
      // Pick Two - Accumulate penalty
      newPenalty += 2;
    } else if (num === 5) {
      // Pick Three - Accumulate penalty
      newPenalty += 3;
    } else if (num === 14) {
      // General Market
      session.players.forEach(p => {
        if (p.id !== playerId && newDeck.length > 0) {
          const card = newDeck.pop()!;
          newPlayerHands[p.id] = [...(newPlayerHands[p.id] || []), card];
        }
      });
    }

    const newState = {
      ...gameState,
      deck: newDeck,
      discardPile: newDiscard,
      playerHands: newPlayerHands,
      penalty: newPenalty,
      currentSuit: requestedSuit || (suit === 'whot' ? SUITS[Math.floor(Math.random() * SUITS.length)] : suit)
    };

    gameService.updateGameState(session.id, newState, session.players[nextTurnIndex].id);
    setShowSuitSelector(false);

    // Check for win
    if (newHand.length === 0) {
      gameService.completeGame(session.id, playerId);
    }
  };

  const handleSuitSelection = (suit: string) => {
    // Find the Whot card in hand
    const whotCard = gameState.playerHands[user.id].find(c => c.startsWith('whot-'));
    if (whotCard) {
      playCard(whotCard, user.id, suit);
    }
  };

  const drawCard = (playerId: string = user.id) => {
    if (session.currentTurn !== playerId) return;
    if (gameState.deck.length === 0) return;

    const newDeck = [...gameState.deck];
    const currentPenalty = gameState.penalty || 0;
    const cardsToDraw = currentPenalty > 0 ? currentPenalty : 1;
    
    const drawnCards: string[] = [];
    for (let i = 0; i < cardsToDraw; i++) {
      if (newDeck.length > 0) {
        drawnCards.push(newDeck.pop()!);
      }
    }

    const newHand = [...(gameState.playerHands[playerId] || []), ...drawnCards];
    
    // If drawing for a penalty, the turn passes. If drawing normally, turn passes.
    const nextTurnIndex = (session.players.findIndex(p => p.id === playerId) + 1) % session.players.length;

    gameService.updateGameState(session.id, {
      ...gameState,
      deck: newDeck,
      playerHands: { ...gameState.playerHands, [playerId]: newHand },
      penalty: 0 // Reset penalty after drawing
    }, session.players[nextTurnIndex].id);
  };

  if (!gameState.discardPile || gameState.discardPile.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-zinc-900 rounded-3xl border border-zinc-800">
        <Layers className="w-16 h-16 text-orange-500 mb-6" />
        <h2 className="text-2xl font-bold mb-4">Whot Session Ready</h2>
        <p className="text-zinc-400 mb-8 text-center max-w-md">
          Wait for all players to join, then the host can start the game.
        </p>
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
  
  const currentHand = gameState.playerHands[session.currentTurn] || [];
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  const winner = session.winner ? session.players.find(p => p.id === session.winner) : null;

  return (
    <div className="space-y-8 relative">
      {/* Header */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between px-4 py-6">
        <Button 
          variant="ghost" 
          onClick={() => gameService.updateSession(session.id, { status: 'waiting' })}
          className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-full"
        >
          <ArrowLeft className="w-5 h-5 mr-2" /> Lobby
        </Button>
        <div className="text-center">
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">WHOT <span className="text-orange-500">NAIJA</span></h1>
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
                <Info className="text-orange-500" /> WHOT RULES
              </h2>
              <div className="space-y-4 text-zinc-400 text-sm">
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <p className="text-white font-bold mb-1">Special Cards:</p>
                  <ul className="space-y-2">
                    <li><span className="text-orange-500 font-bold">1 (Hold On):</span> The player plays again.</li>
                    <li><span className="text-orange-500 font-bold">2 (Pick Two):</span> Next player draws 2 cards unless they defend.</li>
                    <li><span className="text-orange-500 font-bold">5 (Pick Three):</span> Next player draws 3 cards unless they defend.</li>
                    <li><span className="text-orange-500 font-bold">8 (Suspension):</span> The next player skips their turn.</li>
                    <li><span className="text-orange-500 font-bold">14 (General Market):</span> Every other player draws 1 card.</li>
                    <li><span className="text-orange-500 font-bold">20 (Whot):</span> Can be played on any card. Player requests a suit.</li>
                  </ul>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <p className="text-white font-bold mb-1">Defense:</p>
                  <p>You can defend against Pick Two/Three by playing another card of the same number or a Whot card. The penalty accumulates for the next player!</p>
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
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center rounded-3xl"
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
                  ? "You've played your last card! You win!" 
                  : `${winner?.name || 'Opponent'} has finished their cards and won the game.`}
              </p>
              <Button onClick={() => window.location.reload()} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-6 rounded-xl">
                Back to Lobby
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Players */}
      <div className="flex justify-center gap-4 overflow-x-auto pb-4">
        {session.players.map(p => (
          <div key={p.id} className={`flex flex-col items-center p-3 rounded-xl border transition-all ${session.currentTurn === p.id ? 'bg-orange-500/10 border-orange-500' : 'bg-zinc-900 border-zinc-800 opacity-60'}`}>
            <img src={p.avatar} className="w-10 h-10 rounded-full mb-2" alt={p.name} />
            <p className="text-xs font-bold text-white truncate w-20 text-center">{p.name} {p.id === user.id && '(You)'}</p>
            <p className="text-[10px] text-zinc-500">{gameState.playerHands[p.id]?.length || 0} Cards</p>
          </div>
        ))}
      </div>

      {/* Suit Selector Overlay */}
      <AnimatePresence>
        {showSuitSelector && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center rounded-3xl p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl text-center shadow-2xl max-w-md w-full"
            >
              <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">I Request...</h2>
              <p className="text-zinc-400 mb-8 text-sm">Pick the shape you want the next player to follow.</p>
              
              <div className="grid grid-cols-2 gap-4">
                {SUITS.map(suit => (
                  <Button 
                    key={suit}
                    onClick={() => handleSuitSelection(suit)}
                    className="h-24 bg-zinc-800 hover:bg-zinc-700 border-2 border-zinc-700 hover:border-orange-500 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all"
                  >
                    <div className={`w-8 h-8 ${
                      suit === 'circles' ? 'text-blue-500' : 
                      suit === 'triangles' ? 'text-red-500' : 
                      suit === 'crosses' ? 'text-green-500' : 
                      suit === 'squares' ? 'text-orange-500' : 'text-purple-500'
                    }`}>
                      <CardShape suit={suit} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white">{suit}</span>
                  </Button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="flex justify-center items-center gap-16 py-20 bg-[#3e2723] rounded-[4rem] border-[12px] border-[#2e1a16] relative overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.6)]" style={{
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")',
        backgroundColor: '#3e2723'
      }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
        
        {/* Deck */}
        <motion.div 
          whileHover={canIPlay ? { scale: 1.05, y: -10, rotate: -2 } : {}}
          whileTap={canIPlay ? { scale: 0.95 } : {}}
          className="relative group cursor-pointer" 
          onClick={() => canIPlay && drawCard(session.currentTurn)}
        >
          <div className="w-40 h-60 bg-zinc-800 rounded-2xl border-4 border-zinc-700 flex items-center justify-center shadow-[0_15px_35px_rgba(0,0,0,0.4)] transform transition-all group-hover:border-orange-500/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <div className="absolute inset-3 border-2 border-zinc-700/50 rounded-xl flex flex-col items-center justify-center gap-4">
              <Layers className="w-16 h-16 text-zinc-600 group-hover:text-orange-500/50 transition-colors" />
              <div className="text-zinc-600 font-black text-xl tracking-tighter group-hover:text-orange-500/50">MARKET</div>
            </div>
          </div>
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-sm font-black text-white/40 uppercase tracking-widest whitespace-nowrap bg-black/20 px-4 py-1 rounded-full backdrop-blur-md">
            Cards: {gameState.deck.length}
          </div>
        </motion.div>

        {/* Discard Pile */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div 
              key={topCard}
              initial={{ scale: 0.2, opacity: 0, rotate: -90, y: 200, x: -100 }}
              animate={{ scale: 1, opacity: 1, rotate: Math.random() * 10 - 5, y: 0, x: 0 }}
              exit={{ scale: 1.5, opacity: 0, rotate: 45, y: -200, x: 100 }}
              transition={{ type: 'spring', damping: 12, stiffness: 120 }}
              className="relative z-10"
            >
              <WhotCardUI card={topCard} size="xl" disabled />
            </motion.div>
          </AnimatePresence>
          <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 w-full">
            {gameState.penalty > 0 && (
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="bg-red-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg mb-2"
              >
                Penalty: +{gameState.penalty}
              </motion.div>
            )}
            <div className="text-xs font-black text-white/50 uppercase tracking-[0.2em]">Active Suit</div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Badge className="bg-orange-500 text-white capitalize px-6 py-2 text-lg font-black shadow-[0_10px_20px_rgba(249,115,22,0.4)] border-2 border-white/20 rounded-xl">
                {gameState.currentSuit}
              </Badge>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Current Player's Hand (Visible in Local Mode) */}
      <div className="fixed bottom-4 left-0 right-0 px-4 z-40">
        <div className="max-w-6xl mx-auto bg-black/40 backdrop-blur-xl p-6 rounded-t-[3rem] border-t border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-6 px-4">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              {session.isLocal ? `${session.players.find(p => p.id === session.currentTurn)?.name}'s Hand` : 'Your Hand'}
            </h3>
            {canIPlay && (
              <Badge className="bg-green-500 text-white animate-bounce px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter">
                {isThinking ? 'AI is thinking...' : 'Your Turn'}
              </Badge>
            )}
          </div>
          
          <div className="flex justify-center gap-4 overflow-x-auto py-4 px-8 no-scrollbar min-h-[250px] items-end">
            <AnimatePresence>
              {(session.isLocal || isMyTurn ? currentHand : gameState.playerHands[user.id] || []).map((card, i) => (
                <motion.div
                  key={`${card}-${i}`}
                  layout
                  initial={{ y: 200, opacity: 0, rotate: i * 2 - 10 }}
                  animate={{ y: 0, opacity: 1, rotate: i * 2 - 10 }}
                  exit={{ y: -200, opacity: 0, scale: 0.5 }}
                  whileHover={{ y: -40, scale: 1.1, zIndex: 50, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="-ml-8 first:ml-0"
                >
                  <WhotCardUI 
                    card={card} 
                    onClick={() => canIPlay && playCard(card, session.currentTurn)}
                    disabled={!canIPlay}
                    size="lg"
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
