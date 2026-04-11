import { GoogleGenAI } from "@google/genai";
import { GameType, Difficulty } from "../types";

class AIService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }

  async getChessMove(fen: string, history: string[], difficulty: Difficulty = 'hard'): Promise<string> {
    try {
      console.log(`AI Chess Move Requested - FEN: ${fen}, Difficulty: ${difficulty}`);
      let prompt = `You are a professional chess engine. 
      Current FEN: ${fen}
      Move history: ${history.join(', ')}
      
      Analyze the position and provide the best move in Standard Algebraic Notation (SAN).
      Only return the move string, nothing else. Example: e4, Nf3, O-O.`;

      if (difficulty === 'easy') {
        prompt = `You are a beginner chess player. 
        Current FEN: ${fen}
        Move history: ${history.join(', ')}
        
        Provide a legal move in Standard Algebraic Notation (SAN). 
        You should make occasional mistakes or sub-optimal moves.
        Only return the move string, nothing else.`;
      } else if (difficulty === 'very_hard') {
        prompt = `You are a Grandmaster chess engine (Stockfish level). 
        Current FEN: ${fen}
        Move history: ${history.join(', ')}
        
        Analyze the position deeply and provide the absolute best move in Standard Algebraic Notation (SAN).
        Only return the move string, nothing else.`;
      }

      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text.trim();
    } catch (error) {
      console.error("AI Chess Move Error:", error);
      return "";
    }
  }

  async getChessAdvice(fen: string, history: string[], lastMove: string): Promise<string> {
    try {
      const prompt = `You are "Dr. Wolf", a friendly and expert chess coach. 
      Current FEN: ${fen}
      Move history: ${history.join(', ')}
      The last move played was: ${lastMove}
      
      Provide a brief, encouraging, and insightful comment about the last move or the current position. 
      Keep it under 2 sentences. Sound like a mentor. 
      Example: "That's a solid developing move, controlling the center." or "Be careful, your knight is a bit exposed there."`;

      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text.trim();
    } catch (error) {
      console.error("AI Chess Advice Error:", error);
      return "Keep focusing on the center and developing your pieces!";
    }
  }

  async getWhotMove(hand: string[], topCard: string, currentSuit: string, difficulty: Difficulty = 'hard'): Promise<string> {
    try {
      let prompt = `You are playing Whot (Nigerian card game).
      Your hand: ${hand.join(', ')}
      Top card on pile: ${topCard}
      Current suit to follow: ${currentSuit}
      
      Rules:
      - You can play a card if it matches the suit or the number of the top card.
      - Whot (20) can be played on any card.
      - If you have no playable card, return "DRAW".
      
      Pick the best card to play from your hand or "DRAW".
      Only return the card string (e.g., "circles-5") or "DRAW".`;

      if (difficulty === 'easy') {
        prompt += `\nMake a simple move, don't try too hard to win.`;
      } else if (difficulty === 'very_hard') {
        prompt += `\nPlay strategically to win as fast as possible.`;
      }

      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text.trim();
    } catch (error) {
      console.error("AI Whot Error:", error);
      return "DRAW";
    }
  }

  async getLudoMove(positions: number[], diceValues: number[], difficulty: Difficulty = 'hard'): Promise<number> {
    const diceSum = diceValues.reduce((a, b) => a + b, 0);
    const hasSix = diceValues.some(v => v === 6);

    // Simple logic for Ludo AI
    const playableTokens = positions
      .map((pos, idx) => ({ pos, idx }))
      .filter(({ pos }) => (pos === -1 && hasSix) || (pos >= 0 && pos + diceSum <= 57));

    if (playableTokens.length === 0) return -1;

    if (difficulty === 'easy') {
      // Just pick a random playable token
      return playableTokens[Math.floor(Math.random() * playableTokens.length)].idx;
    }

    // Prioritize moving tokens that are already on the board
    const onBoard = playableTokens.filter(t => t.pos >= 0);
    
    if (difficulty === 'very_hard') {
      // Prioritize capturing or getting home
      // (Simplified: just move the one closest to home)
      if (onBoard.length > 0) {
        return onBoard.sort((a, b) => b.pos - a.pos)[0].idx;
      }
    }

    if (onBoard.length > 0) {
      return onBoard.sort((a, b) => b.pos - a.pos)[0].idx;
    }

    return playableTokens[0].idx;
  }

  async getAyoMove(pits: number[], difficulty: Difficulty = 'hard'): Promise<number> {
    // AI pits are 6-11
    const playablePits = [6, 7, 8, 9, 10, 11].filter(i => pits[i] > 0);
    if (playablePits.length === 0) return -1;

    if (difficulty === 'easy') {
      return playablePits[Math.floor(Math.random() * playablePits.length)];
    }

    // Simple heuristic: pick pit that results in most seeds
    // For now, just pick the one with most seeds to sow
    return playablePits.sort((a, b) => pits[b] - pits[a])[0];
  }
}

export const aiService = new AIService();
