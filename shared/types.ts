export type Difficulty = "EASY" | "MED" | "HARD";
export type GameStatus = "LOBBY" | "RUNNING" | "REVEAL" | "ENDED";

export interface PublicQuestion {
  id: string;
  index: number;       // 0-based position in this game
  total: number;
  text: string;
  options: string[];   // length 4
  category: string;
  difficulty: Difficulty;
  posterUrl?: string | null;
  imageUrl?: string | null;
  // NOTE: correctIndex intentionally absent until reveal
}

export interface PlayerPublic {
  id: string; name: string; city?: string | null;
  score: number; streak: number; connected: boolean;
}

export interface LeaderboardRow {
  rank: number; playerId: string; name: string;
  score: number; totalMs: number; correct: number; wrong: number;
  accuracy: number; fastestMs: number | null; streak: number;
}

export interface RevealPayload {
  questionId: string;
  correctIndex: number;
  explanation: string;
  distribution: number[];   // counts per option index (len 4)
  pctCorrect: number;       // 0..100
}

export interface AnswerKeyItem {
  index: number; text: string; options: string[]; correctIndex: number; explanation: string;
}

export interface GameOverPayload {
  podium: LeaderboardRow[];          // up to 3 (joint-aware)
  fullRanking: LeaderboardRow[];
  answerKey: AnswerKeyItem[];        // all questions + correct answers, revealed at end
}

export interface GameSettings {
  timerSec: number; totalQ: number; leaderboardEvery: number;
  autoAdvance: boolean; sound: boolean; music: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  timerSec: 30, totalQ: 40, leaderboardEvery: 5,
  autoAdvance: false, sound: true, music: true,
};

// ---- Socket event maps (typed both ends) ----
export interface ClientToServer {
  "player:join": (p: { pin: string; name: string; city?: string },
    ack: (r: { ok: true; playerId: string; state: PlayerStateSnapshot } | { ok: false; error: string }) => void) => void;
  "player:reconnect": (p: { playerId: string },
    ack: (r: { ok: true; state: PlayerStateSnapshot } | { ok: false; error: string }) => void) => void;
  "answer:submit": (p: { questionId: string; index: number },
    ack: (r: { ok: true; locked: true } | { ok: false; error: string }) => void) => void;

  "host:create": (p: { token: string; settings: GameSettings },
    ack: (r: { ok: true; pin: string; gameId: string } | { ok: false; error: string }) => void) => void;
  "host:attach": (p: { token: string; gameId: string },
    ack: (r: { ok: true; state: HostStateSnapshot } | { ok: false; error: string }) => void) => void;
  "host:control": (p: { token: string; gameId: string; action: HostAction; value?: number },
    ack: (r: { ok: boolean; error?: string }) => void) => void;
}

export type HostAction =
  | "start" | "next" | "prev" | "skip" | "pause" | "resume"
  | "reveal" | "restartQ" | "addTime" | "subTime"
  | "showBoard" | "hideBoard" | "end";

export interface ServerToClient {
  "lobby:update": (p: { players: PlayerPublic[]; count: number }) => void;
  "question:show": (p: { question: PublicQuestion; endsAt: number; paused: boolean }) => void;
  "timer:tick": (p: { remainingMs: number; paused: boolean }) => void;
  "question:reveal": (p: RevealPayload) => void;
  "leaderboard:show": (p: { rows: LeaderboardRow[] }) => void;
  "leaderboard:hide": () => void;
  "game:over": (p: GameOverPayload) => void;
  "player:scored": (p: { score: number; streak: number; isCorrect: boolean; gainedMs: number }) => void;
  "host:analytics": (p: { answered: number; pending: number; liveAccuracy: number; distribution: number[] }) => void;
  "game:reset": () => void;
}

export interface PlayerStateSnapshot {
  status: GameStatus;
  question?: PublicQuestion;
  endsAt?: number;
  alreadyAnswered: boolean;
  selectedIndex?: number;
  score: number; streak: number;
}

export interface HostStateSnapshot {
  status: GameStatus; pin: string; currentIndex: number; total: number;
  players: PlayerPublic[]; question?: PublicQuestion; endsAt?: number; paused: boolean;
}
