import { EventEmitter } from "node:events";
import { scoreAnswer } from "./scoring";
import { resolveRanking } from "./ranking";
import { pickWithFeud } from "../util";
import type { GameSettings, PublicQuestion, GameStatus, PlayerStateSnapshot } from "../../../shared/types";

export interface SeedQuestion {
  id: string; text: string; options: string[]; correctIndex: number;
  explanation: string; difficulty: "EASY" | "MED" | "HARD"; category: string;
  posterUrl?: string | null; imageUrl?: string | null;
}
interface LivePlayer {
  id: string; name: string; city?: string | null; socketId?: string;
  connected: boolean; score: number; streak: number; bestStreak: number;
  completedAt: number;
}
interface LiveAnswer { selectedIndex: number; isCorrect: boolean; responseMs: number; }
interface LiveGame {
  id: string; pin: string; status: GameStatus; settings: GameSettings;
  questions: SeedQuestion[]; currentIndex: number;
  players: Map<string, LivePlayer>;
  answers: Map<string, Map<string, LiveAnswer>>;
  questionShownAt: number; endsAt: number; remainingAtPause: number;
  paused: boolean; timer?: NodeJS.Timeout; advanceTimer?: NodeJS.Timeout; boardVisible: boolean;
  scored: Set<string>;   // question ids already finalized/scored (idempotent)
}

export interface Persistence {
  game: (g: { id: string; pin: string; settings: GameSettings }) => Promise<void> | void;
  player: (gameId: string, p: { name: string; city?: string | null; ip?: string }) => Promise<string>;
  answer: (a: { gameId: string; playerId: string; questionId: string;
    selectedIndex: number; isCorrect: boolean; responseMs: number }) => Promise<void> | void;
  end: (gameId: string) => Promise<void> | void;
}
export interface GMDeps { loadQuestions: () => Promise<SeedQuestion[]>; persist: Persistence; }

const TICK_MS = 250;
// Once every connected player has answered, wait this long (allowing last-second
// answer changes + a visual beat) then auto-advance instead of running the full timer.
const ALL_ANSWERED_GRACE_MS = 2000;
const genPin = () => String(Math.floor(100000 + Math.random() * 900000));
const stripQuestion = (q: SeedQuestion, index: number, total: number): PublicQuestion => ({
  id: q.id, index, total, text: q.text, options: q.options,
  category: q.category, difficulty: q.difficulty, posterUrl: q.posterUrl, imageUrl: q.imageUrl,
});

export class GameManager extends EventEmitter {
  private games = new Map<string, LiveGame>();
  constructor(private deps: GMDeps) { super(); }

  getGameByPin(pin: string) { return [...this.games.values()].find(g => g.pin === pin && g.status !== "ENDED"); }
  getGame(id: string) { return this.games.get(id); }
  getPlayer(gameId: string, playerId: string) { return this.games.get(gameId)?.players.get(playerId); }

  async createGame(settings: GameSettings) {
    // Random subset in random order, drawn from the full pool, GUARANTEEING
    // 2–3 fan-feud questions per game (un-Googleable anti-cheat).
    const questions = pickWithFeud(await this.deps.loadQuestions(), settings.totalQ);
    let pin = genPin(); while (this.getGameByPin(pin)) pin = genPin();
    const id = "g_" + Math.random().toString(36).slice(2, 10);
    const game: LiveGame = {
      id, pin, status: "LOBBY", settings, questions, currentIndex: -1,
      players: new Map(), answers: new Map(), questionShownAt: 0, endsAt: 0,
      remainingAtPause: 0, paused: false, boardVisible: false, scored: new Set(),
    };
    this.games.set(id, game);
    await this.deps.persist.game({ id, pin, settings });
    return game;
  }

  async addPlayer(gameId: string, p: { name: string; city?: string | null; socketId?: string; ip?: string }) {
    const g = this.req(gameId);
    if (g.status !== "LOBBY") throw new Error("Game already started");
    const name = p.name.trim();
    if (!name) throw new Error("Name required");
    if ([...g.players.values()].some(x => x.name.toLowerCase() === name.toLowerCase()))
      throw new Error("That name is already taken");
    const id = await this.deps.persist.player(gameId, { name, city: p.city, ip: p.ip });
    const player: LivePlayer = { id, name, city: p.city, socketId: p.socketId,
      connected: true, score: 0, streak: 0, bestStreak: 0, completedAt: 0 };
    g.players.set(id, player);
    this.emitLobby(g);
    return player;
  }

  reconnect(gameId: string, playerId: string, socketId: string) {
    const g = this.games.get(gameId); const p = g?.players.get(playerId);
    if (!g || !p) return null;
    p.connected = true; p.socketId = socketId; this.emitLobby(g);
    return { g, p };
  }

  reconnectByPlayer(playerId: string, socketId: string): { gameId: string; state: PlayerStateSnapshot } | null {
    for (const g of this.games.values()) {
      const p = g.players.get(playerId);
      if (!p) continue;
      p.connected = true; p.socketId = socketId; this.emitLobby(g);
      const q = g.questions[g.currentIndex];
      const answered = q ? (g.answers.get(q.id)?.has(playerId) ?? false) : false;
      const state: PlayerStateSnapshot = {
        status: g.status,
        question: q && g.status !== "ENDED" ? stripQuestion(q, g.currentIndex, g.questions.length) : undefined,
        endsAt: g.status === "RUNNING" ? g.endsAt : undefined,
        alreadyAnswered: answered,
        score: p.score, streak: p.streak,
      };
      return { gameId: g.id, state };
    }
    return null;
  }
  disconnectSocket(socketId: string) {
    for (const g of this.games.values())
      for (const p of g.players.values())
        if (p.socketId === socketId) { p.connected = false; this.emitLobby(g); return; }
  }

  async start(gameId: string) { const g = this.req(gameId); if (g.status === "LOBBY") this.showQuestion(g, 0); }

  private showQuestion(g: LiveGame, index: number) {
    if (index < 0 || index >= g.questions.length) return this.end(g.id);
    this.clearTimer(g);
    g.currentIndex = index; g.status = "RUNNING"; g.paused = false; g.boardVisible = false;
    g.questionShownAt = Date.now();
    g.endsAt = g.questionShownAt + g.settings.timerSec * 1000;
    const q = g.questions[index];
    if (!g.answers.has(q.id)) g.answers.set(q.id, new Map());
    this.emit("question:show", g.id, {
      question: stripQuestion(q, index, g.questions.length), endsAt: g.endsAt, paused: false });
    this.startTimer(g);
    this.emitAnalytics(g);
  }

  private startTimer(g: LiveGame) {
    g.timer = setInterval(() => {
      if (g.paused) return;
      const remaining = g.endsAt - Date.now();
      this.emit("timer:tick", g.id, { remainingMs: Math.max(0, remaining), paused: false });
      // Auto-advance: when the 30s timer expires, finalize this question's answers
      // (scoring last-submitted answer per player) and move to the next. After the last
      // question, end() fires and the full answer key + scores are revealed together.
      if (remaining <= 0) this.next(g.id);
    }, TICK_MS);
  }
  private clearTimer(g: LiveGame) {
    if (g.timer) { clearInterval(g.timer); g.timer = undefined; }
    if (g.advanceTimer) { clearTimeout(g.advanceTimer); g.advanceTimer = undefined; }
  }

  // Players may change their answer freely while the question is RUNNING; the last
  // submission wins. Scoring is deferred to finalizeQuestion() when the timer closes.
  async submitAnswer(gameId: string, playerId: string, questionId: string, index: number) {
    const g = this.games.get(gameId);
    if (!g || g.status !== "RUNNING") return { ok: false as const, error: "No active question" };
    const q = g.questions[g.currentIndex];
    if (!q || q.id !== questionId) return { ok: false as const, error: "Question mismatch" };
    const p = g.players.get(playerId);
    if (!p) return { ok: false as const, error: "Unknown player" };
    if (index < 0 || index > 3) return { ok: false as const, error: "Invalid option" };
    const map = g.answers.get(q.id)!;
    const responseMs = Date.now() - g.questionShownAt;
    // overwrite any previous selection for this question (isCorrect is provisional here)
    map.set(playerId, { selectedIndex: index, isCorrect: index === q.correctIndex, responseMs });
    this.emitAnalytics(g);
    // If every connected player has now answered, schedule an early advance (after a
    // short grace so the last answerer can still change their pick). The 30s timer
    // remains as the fallback. Only one advance fires — whichever comes first.
    const connected = [...g.players.values()].filter(p => p.connected);
    if (!g.paused && !g.advanceTimer && connected.length > 0 && connected.every(p => map.has(p.id))) {
      g.advanceTimer = setTimeout(() => { g.advanceTimer = undefined; this.next(g.id); }, ALL_ANSWERED_GRACE_MS);
    }
    return { ok: true as const };
  }

  // Finalize the current question: score each player's final answer (in question order,
  // so streaks stay correct), persist it, and notify the player. Idempotent per question.
  private finalizeQuestion(g: LiveGame) {
    if (g.currentIndex < 0) return;
    const q = g.questions[g.currentIndex];
    if (!q || g.scored.has(q.id)) return;
    g.scored.add(q.id);
    const map = g.answers.get(q.id) ?? new Map<string, LiveAnswer>();
    for (const [playerId, ans] of map) {
      const p = g.players.get(playerId);
      if (!p) continue;
      ans.isCorrect = ans.selectedIndex === q.correctIndex;
      const next = scoreAnswer(p, ans.isCorrect);
      p.score = next.score; p.streak = next.streak; p.bestStreak = next.bestStreak;
      p.completedAt = Date.now();
      void this.deps.persist.answer({ gameId: g.id, playerId, questionId: q.id,
        selectedIndex: ans.selectedIndex, isCorrect: ans.isCorrect, responseMs: ans.responseMs });
      this.emit("player:scored", g.id, playerId, {
        score: p.score, streak: p.streak, isCorrect: ans.isCorrect, gainedMs: ans.responseMs });
    }
  }

  reveal(gameId: string) {
    const g = this.req(gameId);
    if (g.status !== "RUNNING") return;
    this.clearTimer(g); g.status = "REVEAL";
    const q = g.questions[g.currentIndex];
    const map = g.answers.get(q.id)!;
    const distribution = [0, 0, 0, 0];
    let correct = 0;
    for (const a of map.values()) { distribution[a.selectedIndex]++; if (a.isCorrect) correct++; }
    const answered = map.size;
    this.emit("question:reveal", g.id, {
      questionId: q.id, correctIndex: q.correctIndex, explanation: q.explanation,
      distribution, pctCorrect: answered ? (correct / answered) * 100 : 0 });
  }

  next(gameId: string) { const g = this.req(gameId); this.finalizeQuestion(g); this.showQuestion(g, g.currentIndex + 1); }
  prev(gameId: string) { const g = this.req(gameId); this.showQuestion(g, Math.max(0, g.currentIndex - 1)); }
  skip(gameId: string) { this.next(gameId); }
  restartQ(gameId: string) { const g = this.req(gameId); this.showQuestion(g, g.currentIndex); }
  pause(gameId: string) {
    const g = this.req(gameId); if (g.status !== "RUNNING" || g.paused) return;
    if (g.advanceTimer) { clearTimeout(g.advanceTimer); g.advanceTimer = undefined; }
    g.paused = true; g.remainingAtPause = g.endsAt - Date.now();
    this.emit("timer:tick", g.id, { remainingMs: Math.max(0, g.remainingAtPause), paused: true });
  }
  resume(gameId: string) {
    const g = this.req(gameId); if (g.status !== "RUNNING" || !g.paused) return;
    g.paused = false; g.endsAt = Date.now() + g.remainingAtPause;
  }
  addTime(gameId: string, sec: number) { const g = this.req(gameId); g.endsAt += sec * 1000; if (g.paused) g.remainingAtPause += sec * 1000; }
  subTime(gameId: string, sec: number) { const g = this.req(gameId); g.endsAt -= sec * 1000; if (g.paused) g.remainingAtPause -= sec * 1000; }
  showBoard(gameId: string) { const g = this.req(gameId); g.boardVisible = true; this.emit("leaderboard:show", g.id, { rows: this.leaderboard(g) }); }
  hideBoard(gameId: string) { const g = this.req(gameId); g.boardVisible = false; this.emit("leaderboard:hide", g.id); }

  async end(gameId: string) {
    const g = this.req(gameId); this.finalizeQuestion(g); this.clearTimer(g); g.status = "ENDED";
    await this.deps.persist.end(gameId);
    const rows = this.leaderboard(g);
    const answerKey = g.questions.map((q, i) => ({
      index: i, text: q.text, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation,
    }));
    this.emit("game:over", g.id, { podium: rows.slice(0, 3), fullRanking: rows, answerKey });
  }

  leaderboard(g: LiveGame) {
    const inputs = [...g.players.values()].map(p => {
      let totalMs = 0, correct = 0, wrong = 0, fastest: number | null = null;
      for (const map of g.answers.values()) {
        const a = map.get(p.id); if (!a) continue;
        totalMs += a.responseMs;
        if (a.isCorrect) { correct++; fastest = fastest === null ? a.responseMs : Math.min(fastest, a.responseMs); }
        else wrong++;
      }
      return { playerId: p.id, name: p.name, score: p.score, totalMs,
        fastestCorrectMs: fastest, bestStreak: p.bestStreak, completedAt: p.completedAt, correct, wrong };
    });
    return resolveRanking(inputs).map((r) => ({
      rank: r.rank, playerId: r.playerId, name: r.name, score: r.score, totalMs: r.totalMs,
      correct: r.correct, wrong: r.wrong,
      accuracy: (r.correct + r.wrong) ? (r.correct / (r.correct + r.wrong)) * 100 : 0,
      fastestMs: r.fastestCorrectMs, streak: r.bestStreak,
    }));
  }
  publicPlayers(g: LiveGame) {
    return [...g.players.values()].map(p => ({ id: p.id, name: p.name, city: p.city,
      score: p.score, streak: p.streak, connected: p.connected }));
  }
  private emitLobby(g: LiveGame) {
    const players = this.publicPlayers(g);
    this.emit("lobby:update", g.id, { players, count: players.length });
  }
  private emitAnalytics(g: LiveGame) {
    const q = g.questions[g.currentIndex]; if (!q) return;
    const map = g.answers.get(q.id) ?? new Map();
    const distribution = [0, 0, 0, 0]; let correct = 0;
    for (const a of map.values()) { distribution[a.selectedIndex]++; if (a.isCorrect) correct++; }
    const total = [...g.players.values()].filter(p => p.connected).length;
    const answered = map.size;
    this.emit("host:analytics", g.id, {
      answered, pending: Math.max(0, total - answered),
      liveAccuracy: answered ? (correct / answered) * 100 : 0, distribution });
  }
  private req(id: string) { const g = this.games.get(id); if (!g) throw new Error("Game not found"); return g; }
}
