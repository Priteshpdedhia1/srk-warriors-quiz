import { Router } from "express";
import { prisma } from "../db";
import { startSession, getSession, submitSolo, finalize, type SoloQuestion } from "../services/soloManager";
import { resolveRanking, type RankInput } from "../services/ranking";

export const solo = Router();

async function loadQuestions(): Promise<SoloQuestion[]> {
  const qs = await prisma.question.findMany({ orderBy: { order: "asc" } });
  return qs.map(q => ({ id: q.id, text: q.text, options: q.options as string[],
    correctIndex: q.correctIndex, explanation: q.explanation, difficulty: q.difficulty, category: q.category }));
}

async function rankedResults() {
  const all = await prisma.soloResult.findMany();
  const inputs: RankInput[] = all.map(x => ({
    playerId: x.id, name: x.name, score: x.score, totalMs: x.totalMs,
    fastestCorrectMs: x.fastestMs, bestStreak: x.bestStreak,
    completedAt: x.createdAt.getTime(), correct: x.correct, wrong: x.wrong,
  }));
  return resolveRanking(inputs);
}

// Start a solo attempt. One attempt per name.
solo.post("/solo/start", async (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 40);
  if (!name) return res.status(400).json({ ok: false, error: "Name required" });
  const existing = await prisma.soloResult.findUnique({ where: { name } });
  if (existing) return res.status(409).json({ ok: false, error: "That name has already played" });
  const questions = (await loadQuestions()).slice(0, 40);
  if (questions.length === 0) return res.status(500).json({ ok: false, error: "No questions available" });
  res.json({ ok: true, ...startSession(name, questions) });
});

// Submit an answer (index -1 = timed out) and get the next question, or the final result.
solo.post("/solo/answer", async (req, res) => {
  const sessionId = String(req.body?.sessionId ?? "");
  const questionId = String(req.body?.questionId ?? "");
  const idx = Number(req.body?.index);
  const s = getSession(sessionId);
  if (!s) return res.status(404).json({ ok: false, error: "Session expired — please restart" });
  const r = submitSolo(s, questionId, Number.isFinite(idx) ? idx : -1);
  if ("error" in r) return res.status(400).json({ ok: false, error: r.error });
  if (!r.done) return res.json({ ok: true, done: false, question: r.question, endsAt: r.endsAt });

  const result = finalize(s);
  await prisma.soloResult.create({ data: {
    name: result.name, score: result.score, totalMs: result.totalMs, correct: result.correct,
    wrong: result.wrong, fastestMs: result.fastestMs, bestStreak: result.bestStreak,
  } }).catch(() => {}); // ignore unique-name race
  const ranked = await rankedResults();
  const me = ranked.find(x => x.name === result.name);
  res.json({ ok: true, done: true, result, rank: me?.rank ?? null, total: ranked.length, answerKey: result.answerKey });
});

// Public all-time leaderboard.
solo.get("/solo/leaderboard", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const ranked = await rankedResults();
  res.json({ ok: true, total: ranked.length, rows: ranked.slice(0, limit).map(r => ({
    rank: r.rank, playerId: r.playerId, name: r.name, score: r.score, totalMs: r.totalMs,
    correct: r.correct, wrong: r.wrong,
    accuracy: (r.correct + r.wrong) ? (r.correct / (r.correct + r.wrong)) * 100 : 0,
    fastestMs: r.fastestCorrectMs, streak: r.bestStreak,
  })) });
});
