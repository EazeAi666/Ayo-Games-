import { useState, useEffect } from 'react';
import { GameSession, GameType, Player, Difficulty } from '../types';
import { gameService } from '../services/gameService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, Swords, PlayCircle, User, Settings2, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LobbyProps {
  user: Player;
  onJoinGame: (session: GameSession) => void;
}

export default function Lobby({ user, onJoinGame }: LobbyProps) {
  console.log("Lobby mounting for user:", user.name);
  const [activeGames, setActiveGames] = useState<GameSession[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [setupGame, setSetupGame] = useState<{ type: GameType; mode: 'ai' | 'local' | 'online' } | null>(null);
  const [resumePrompt, setResumePrompt] = useState<{ type: GameType; mode: 'ai' | 'local' | 'online'; session: GameSession } | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [chessColor, setChessColor] = useState<'white' | 'black'>('white');
  const [playerCount, setPlayerCount] = useState<number>(2);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user.name);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const games = await gameService.getActiveGames();
        setActiveGames(games);
      } catch (err) {
        console.error("Failed to fetch games:", err);
      }
    };
    const fetchLeaderboard = async () => {
      try {
        const stats = await gameService.getLeaderboard();
        setLeaderboard(stats);
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      }
    };
    fetchGames();
    fetchLeaderboard();
    
    const interval = setInterval(() => {
      fetchGames();
      fetchLeaderboard();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateProfile = () => {
    const updatedUser = { ...user, name: profileName };
    localStorage.setItem('ayo_user', JSON.stringify(updatedUser));
    window.location.reload(); // Simple way to refresh user state in App.tsx
  };

  const handleStartGame = async () => {
    if (!setupGame) return;
    setIsCreating(true);
    try {
      let session;
      const userWithColor = { ...user, color: setupGame.type === 'chess' ? chessColor : undefined };
      
      if (setupGame.mode === 'ai') {
        session = await gameService.createAIGame(setupGame.type, userWithColor, difficulty);
      } else if (setupGame.mode === 'local') {
        session = await gameService.createLocalGame(setupGame.type, userWithColor, playerCount);
      } else {
        session = await gameService.createGame(setupGame.type, userWithColor);
      }
      onJoinGame(session);
    } finally {
      setIsCreating(false);
      setSetupGame(null);
    }
  };

  const checkResume = async (type: GameType, mode: 'ai' | 'local' | 'online') => {
    const existing = await gameService.getResumeableGame(user.id, type);
    // Only prompt resume for AI or Local games for now, as Online games depend on other players
    if (existing && (mode === 'ai' || mode === 'local')) {
      setResumePrompt({ type, mode, session: existing });
    } else {
      setSetupGame({ type, mode });
    }
  };

  const handleJoinGame = async (gameId: string) => {
    try {
      const session = await gameService.joinGame(gameId, user);
      onJoinGame(session);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const gameOptions = [
    { type: 'chess' as GameType, name: 'Chess', icon: '♟️', description: 'The classic game of strategy. Master the rules to win.' },
    { type: 'whot' as GameType, name: 'Whot', icon: '🃏', description: 'Nigerian favorite card game. Fast and fun.' },
    { type: 'ludo' as GameType, name: 'Ludo', icon: '🎲', description: 'Race your tokens to the finish. Watch out for opponents.' },
    { type: 'ayo' as GameType, name: 'Ayo', icon: '🕳️', description: 'Traditional Mancala game. Strategic seed sowing.' },
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Profile Section */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative group">
            <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-orange-500 shadow-lg" alt="Profile" />
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
              <Settings2 className="text-white w-6 h-6" />
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            {isEditingProfile ? (
              <div className="flex items-center gap-2 max-w-xs mx-auto md:mx-0">
                <Input 
                  value={profileName} 
                  onChange={(e) => setProfileName(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
                <Button onClick={handleUpdateProfile} size="sm" className="bg-orange-500 hover:bg-orange-600">Save</Button>
                <Button onClick={() => setIsEditingProfile(false)} variant="ghost" size="sm">Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center justify-center md:justify-start gap-3">
                <h1 className="text-3xl font-bold text-white">{user.name}</h1>
                <Button onClick={() => setIsEditingProfile(true)} variant="ghost" size="icon" className="text-zinc-500 hover:text-white">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="flex items-center justify-center md:justify-start gap-4 mt-2">
              <div className="flex items-center gap-1 text-zinc-400 text-sm">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span>{user.wins || 0} Wins</span>
              </div>
              <div className="flex items-center gap-1 text-zinc-400 text-sm">
                <Swords className="w-4 h-4 text-red-500" />
                <span>{user.losses || 0} Losses</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resume Prompt Modal */}
      <AnimatePresence>
        {resumePrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <PlayCircle className="text-orange-500 w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Continue Game?</h2>
              <p className="text-zinc-400 mb-8">
                You have an unfinished {resumePrompt.type} game. Would you like to continue from where you left off or start a new one?
              </p>
              
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => {
                    onJoinGame(resumePrompt.session);
                    setResumePrompt(null);
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-12"
                >
                  Continue Game
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    gameService.deleteSession(resumePrompt.session.id);
                    setSetupGame({ type: resumePrompt.type, mode: resumePrompt.mode });
                    setResumePrompt(null);
                  }}
                  className="w-full border-zinc-800 hover:bg-zinc-800 text-white h-12"
                >
                  Start New Game
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setResumePrompt(null)}
                  className="w-full text-zinc-500"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Setup Modal Overlay */}
      <AnimatePresence>
        {setupGame && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Settings2 className="text-orange-500" /> Game Settings
              </h2>
              
              <div className="space-y-6">
                {setupGame.mode === 'ai' && (
                  <div className="space-y-3">
                    <Label className="text-zinc-400">AI Difficulty</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['easy', 'hard', 'very_hard'] as Difficulty[]).map((d) => (
                        <Button
                          key={d}
                          variant="outline"
                          onClick={() => setDifficulty(d)}
                          className={`h-12 border-2 transition-all capitalize font-bold ${
                            difficulty === d 
                              ? 'border-orange-500 bg-orange-500/10 text-orange-500' 
                              : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                          }`}
                        >
                          {d.replace('_', ' ')}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {setupGame.mode === 'local' && (setupGame.type === 'whot' || setupGame.type === 'ludo') && (
                  <div className="space-y-3">
                    <Label className="text-zinc-400">Number of Players</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[2, 3, 4].map((n) => (
                        <Button
                          key={n}
                          variant="outline"
                          onClick={() => setPlayerCount(n)}
                          className={`h-12 border-2 transition-all font-bold ${
                            playerCount === n 
                              ? 'border-orange-500 bg-orange-500/10 text-orange-500' 
                              : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                          }`}
                        >
                          {n} Players
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {setupGame.type === 'chess' && (
                  <div className="space-y-3">
                    <Label className="text-zinc-400">Your Color</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        onClick={() => setChessColor('white')}
                        className={`h-16 border-2 transition-all flex items-center gap-3 px-4 ${
                          chessColor === 'white' 
                            ? 'border-orange-500 bg-orange-500/10' 
                            : 'border-zinc-800 bg-zinc-900'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-white border border-zinc-300 shadow-sm" />
                        <span className={`font-bold ${chessColor === 'white' ? 'text-orange-500' : 'text-zinc-400'}`}>White</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setChessColor('black')}
                        className={`h-16 border-2 transition-all flex items-center gap-3 px-4 ${
                          chessColor === 'black' 
                            ? 'border-orange-500 bg-orange-500/10' 
                            : 'border-zinc-800 bg-zinc-900'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-black border border-zinc-700 shadow-sm" />
                        <span className={`font-bold ${chessColor === 'black' ? 'text-orange-500' : 'text-zinc-400'}`}>Black</span>
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button onClick={() => setSetupGame(null)} variant="ghost" className="flex-1 text-zinc-400">Cancel</Button>
                  <Button onClick={handleStartGame} disabled={isCreating} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold">
                    {isCreating ? 'Creating...' : 'Start Game'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Plus className="text-orange-500" /> Start a Session
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {gameOptions.map((game) => (
            <Card key={game.type} className="bg-zinc-900 border-zinc-800 hover:border-orange-500/50 transition-all group overflow-hidden">
              <CardHeader>
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform duration-300">{game.icon}</div>
                <CardTitle className="text-white">{game.name}</CardTitle>
                <CardDescription className="text-zinc-400">{game.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  onClick={() => checkResume(game.type, 'online')} 
                  disabled={isCreating}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white border-none"
                >
                  Online Multiplayer
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => checkResume(game.type, 'ai')} 
                    disabled={isCreating}
                    className="border-zinc-700 hover:bg-zinc-800 text-xs"
                  >
                    AI Training
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => checkResume(game.type, 'local')} 
                    disabled={isCreating}
                    className="border-zinc-700 hover:bg-zinc-800 text-xs"
                  >
                    Local Family
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="text-orange-500" /> Player Statistics
          </h2>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-800/50 border-b border-zinc-800">
                  <th className="px-6 py-4 text-xs font-black text-zinc-500 uppercase tracking-widest">Player</th>
                  <th className="px-6 py-4 text-xs font-black text-zinc-500 uppercase tracking-widest text-center">Wins</th>
                  <th className="px-6 py-4 text-xs font-black text-zinc-500 uppercase tracking-widest text-center">Losses</th>
                  <th className="px-6 py-4 text-xs font-black text-zinc-500 uppercase tracking-widest text-center">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 italic">
                      No statistics available yet. Play some games to see the leaderboard!
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((player, index) => {
                    const totalGames = player.wins + player.losses;
                    const winRate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;
                    return (
                      <motion.tr 
                        key={player.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img src={player.avatar} className="w-10 h-10 rounded-full border-2 border-zinc-700" alt={player.name} />
                              {index < 3 && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white border-2 border-zinc-900">
                                  {index + 1}
                                </div>
                              )}
                            </div>
                            <span className="font-bold text-white">{player.name}</span>
                            {player.id === user.id && <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/50">You</Badge>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-green-500">{player.wins}</td>
                        <td className="px-6 py-4 text-center font-bold text-red-500">{player.losses}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-white">{winRate}%</span>
                            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-orange-500" 
                                style={{ width: `${winRate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="text-orange-500" /> Active Sessions
          </h2>
          <Badge variant="outline" className="text-zinc-400 border-zinc-800">
            {activeGames.length} Games Available
          </Badge>
        </div>

        {activeGames.length === 0 ? (
          <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl p-12 text-center">
            <div className="flex justify-center mb-4">
              <PlayCircle className="w-12 h-12 text-zinc-700" />
            </div>
            <p className="text-zinc-500">No active games found. Why not start one?</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeGames.map((game) => (
              <motion.div
                key={game.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center text-2xl">
                    {game.type === 'chess' ? '♟️' : game.type === 'whot' ? '🃏' : '🎲'}
                  </div>
                  <div>
                    <h3 className="font-bold text-white capitalize">{game.type} Session</h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Users className="w-3 h-3" />
                      <span>{game.players.length} Players</span>
                      <span>•</span>
                      <span>ID: {game.id}</span>
                    </div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleJoinGame(game.id)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Join
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
