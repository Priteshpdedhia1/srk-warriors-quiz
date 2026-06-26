import { create } from "zustand";
import type { PublicQuestion, PlayerPublic, LeaderboardRow, RevealPayload, GameOverPayload } from "../lib/types";

interface GS {
  playerId?: string; pin?: string; gameId?: string;
  question?: PublicQuestion; endsAt?: number; paused: boolean;
  selectedIndex?: number; locked: boolean;
  score: number; streak: number;
  players: PlayerPublic[]; reveal?: RevealPayload;
  leaderboard?: LeaderboardRow[]; boardVisible: boolean;
  analytics?: { answered: number; pending: number; liveAccuracy: number; distribution: number[] };
  over?: GameOverPayload;
  set: (p: Partial<GS>) => void; reset: () => void;
}
const init = { paused: false, locked: false, score: 0, streak: 0, players: [], boardVisible: false };
export const useGame = create<GS>((set) => ({
  ...init,
  set: (p) => set(p),
  reset: () => set({ ...init, question: undefined, reveal: undefined, over: undefined,
    leaderboard: undefined, analytics: undefined, selectedIndex: undefined, endsAt: undefined }),
}));
