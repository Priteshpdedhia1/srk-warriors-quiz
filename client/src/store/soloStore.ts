import { create } from "zustand";
import type { PublicQuestion, AnswerKeyItem, LeaderboardRow } from "../lib/types";

export interface SoloOver {
  result: { name: string; score: number; totalMs: number; correct: number; wrong: number;
    fastestMs: number | null; bestStreak: number; accuracy: number };
  rank: number | null; total: number; answerKey: AnswerKeyItem[];
}

interface SoloState {
  sessionId?: string; name?: string;
  question?: PublicQuestion; endsAt?: number; total: number;
  myAnswers: Record<number, number>;   // questionIndex -> chosen option (-1 = timed out)
  over?: SoloOver;
  set: (p: Partial<SoloState>) => void;
  reset: () => void;
}
const init = { total: 0, myAnswers: {} as Record<number, number> };
export const useSolo = create<SoloState>((set) => ({
  ...init,
  set: (p) => set(p),
  reset: () => set({ ...init, myAnswers: {}, sessionId: undefined, name: undefined,
    question: undefined, endsAt: undefined, over: undefined }),
}));

export type { LeaderboardRow };
