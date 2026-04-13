import React from 'react';
import { motion } from 'motion/react';
import { Gamepad2, Swords, Users, Trophy, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-hidden selection:bg-orange-500/30">
      {/* Hero Section */}
      <div className="relative pt-20 pb-32 px-4">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-full pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-orange-500/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-red-500/10 blur-[120px] rounded-full animate-pulse delay-700" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Naija's #1 Game Hub</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9]"
          >
            PLAY THE GAMES <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
              YOU LOVE.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Experience Ayo, Whot, Ludo, and Chess like never before. 
            Compete with friends, challenge the AI, and climb the global leaderboard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button 
              onClick={onStart}
              className="h-16 px-10 bg-orange-500 hover:bg-orange-600 text-white text-lg font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95 group"
            >
              Get Started Now
              <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              variant="outline"
              className="h-16 px-10 border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-lg font-bold rounded-2xl transition-all"
            >
              View Leaderboard
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-4 py-24 border-t border-zinc-900">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: <Users className="w-8 h-8 text-orange-500" />,
              title: "Multiplayer",
              desc: "Play with anyone, anywhere in real-time with our low-latency game server."
            },
            {
              icon: <Swords className="w-8 h-8 text-red-500" />,
              title: "AI Opponents",
              desc: "Sharpen your skills against our advanced AI with multiple difficulty levels."
            },
            {
              icon: <Trophy className="w-8 h-8 text-yellow-500" />,
              title: "Global Stats",
              desc: "Track your progress, earn wins, and see how you stack up against the best."
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <div className="mb-6">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-4 text-white">{feature.title}</h3>
              <p className="text-zinc-500 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Game Showcase */}
      <div className="bg-zinc-900/30 py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-4xl font-black mb-6 tracking-tight">TRADITIONAL GAMES, <br />MODERN EXPERIENCE.</h2>
              <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
                We've taken the games you grew up with and rebuilt them for the digital age. 
                Beautiful animations, smooth controls, and authentic rules.
              </p>
              <ul className="space-y-4">
                {['Ayo Ncho', 'Whot', 'Ludo', 'Chess'].map((game, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-300 font-medium">
                    <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                    </div>
                    {game}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 relative">
              <div className="aspect-square bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-[3rem] border border-white/5 flex items-center justify-center p-12">
                <Gamepad2 className="w-48 h-48 text-white/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      y: [0, -20, 0]
                    }}
                    transition={{ duration: 6, repeat: Infinity }}
                    className="text-9xl"
                  >
                    ♟️
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-900 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Gamepad2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">AYO GAMES</span>
        </div>
        <p className="text-zinc-500 text-sm">© 2026 Ayo Games. All rights reserved.</p>
      </footer>
    </div>
  );
}
