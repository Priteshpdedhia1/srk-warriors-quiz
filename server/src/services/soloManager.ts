import { scoreAnswer } from "./scoring";
import type { PublicQuestion } from "../../../shared/types";

// Self-paced solo quiz sessions, held in memory while a player takes the quiz.
// The final result is persisted to SoloResult by the route. Server-timed: response
// time is measured from when the server served each question, so it can't be gamed
// by pausing a client timer, and correct answers are never sent until the end.

export interface SoloQuestion {
  id: string; text: string; options: string[]; correctIndex: number;
  explanation: string; difficulty: "EASY" | "MED" | "HARD"; category: string;
}
interface SoloAnswer { selectedIndex: number; isCorrect: boolean; responseMs: number; }
interface SoloSession {
  id: string; name: string; questions: SoloQuestion[]; index: number;
  questionShownAt: number; answers: Map<string, SoloAnswer>;
  score: number; streak: number; bestStreak: number; startedAt: number;
}

const SESSIONS = new Map<string, SoloSession>();
const TIMER_SEC = 30;
const SESSION_TTL_MS = 40 * 60 * 1000; // drop abandoned sessions after 40 min

const genId = () => "s_" + Math.random().toString(36).slice(2, 12);
function sweep() {
  const now = Date.now();
  for (const [id, s] of SESSIONS) if (now - s.startedAt > SESSION_TTL_MS) SESSIONS.delete(id);
}
const strip = (q: SoloQuestion, index: number, total: number): PublicQuestion => ({
  id: q.id, index, total, text: q.text, options: q.options, category: q.category, difficulty: q.difficulty,
});

export function startSession(name: string, questions: SoloQuestion[]) {
  sweep();
  const id = genId();
  const s: SoloSession = {
    id, name, questions, index: 0, questionShownAt: Date.now(),
    answers: new Map(), score: 0, streak: 0, bestStreak: 0, startedAt: Date.now(),
  };
  SESSIONS.set(id, s);
  return { sessionId: id, question: strip(questions[0], 0, questions.length),
    endsAt: s.questionShownAt + TIMER_SEC * 1000, total: questions.length };
}

export function getSession(id: string) { return SESSIONS.get(id); }

// Record the answer to the current question (index -1 = timed out / no answer),
// score it, and advance. Returns the next question or done.
export function submitSolo(s: SoloSession, questionId: string, index: number) {
  const q = s.questions[s.index];
  if (!q || q.id !== questionId) return { error: "Question mismatch" as const };
  if (!s.answers.has(q.id)) {
    const responseMs = Math.min(Date.now() - s.questionShownAt, TIMER_SEC * 1000);
    const isCorrect = index === q.correctIndex; // -1 never matches -> wrong
    s.answers.set(q.id, { selectedIndex: index, isCorrect, responseMs });
    const n = scoreAnswer(s, isCorrect);
    s.score = n.score; s.streak = n.streak; s.bestStreak = n.bestStreak;
  }
  s.index++;
  if (s.index >= s.questions.length) return { done: true as const };
  s.questionShownAt = Date.now();
  return { done: false as const, question: strip(s.questions[s.index], s.index, s.questions.length),
    endsAt: s.questionShownAt + TIMER_SEC * 1000 };
}

export function finalize(s: SoloSession) {
  let totalMs = 0, correct = 0, wrong = 0, fastest: number | null = null;
  for (const a of s.answers.values()) {
    totalMs += a.responseMs;
    if (a.isCorrect) { correct++; fastest = fastest === null ? a.responseMs : Math.min(fastest, a.responseMs); }
    else wrong++;
  }
  SESSIONS.delete(s.id);
  return {
    name: s.name, score: s.score, totalMs, correct, wrong, fastestMs: fastest, bestStreak: s.bestStreak,
    accuracy: (correct + wrong) ? (correct / (correct + wrong)) * 100 : 0,
    answerKey: s.questions.map((q, i) => ({
      index: i, text: q.text, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation,
    })),
  };
}
