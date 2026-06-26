import { Router } from "express";
import { prisma } from "../db";
import { verifyHost } from "./auth";
import { resolveRanking, type RankInput } from "../services/ranking";

export const results = Router();

// All endpoints are host-only. Token may arrive via Authorization header or ?token=
// (query param is used for plain <a download> links the browser can't add headers to).
function authed(req: any): boolean {
  const header = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const token = (req.query.token as string) || header;
  return verifyHost(token);
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: (string | number | null)[][]) => rows.map(r => r.map(csvCell).join(",")).join("\r\n");

// Build the final ranking for a game straight from persisted rows.
async function computeResults(gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return null;
  const players = await prisma.player.findMany({ where: { gameId } });
  const answers = await prisma.answer.findMany({ where: { gameId } });
  const byPlayer = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = byPlayer.get(a.playerId) ?? [];
    list.push(a); byPlayer.set(a.playerId, list);
  }
  const inputs: RankInput[] = players.map(p => {
    const list = byPlayer.get(p.id) ?? [];
    let totalMs = 0, correct = 0, wrong = 0, fastest: number | null = null, lastAt = 0;
    for (const a of list) {
      totalMs += a.responseMs;
      if (a.isCorrect) { correct++; fastest = fastest === null ? a.responseMs : Math.min(fastest, a.responseMs); }
      else wrong++;
      lastAt = Math.max(lastAt, a.createdAt.getTime());
    }
    return { playerId: p.id, name: p.name, score: p.score, totalMs,
      fastestCorrectMs: fastest, bestStreak: p.bestStreak, completedAt: lastAt, correct, wrong };
  });
  const ranked = resolveRanking(inputs);
  return { game, players, answers, ranked };
}

// List past games so the host can pick one to export.
results.get("/results/games", async (req, res) => {
  if (!authed(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const games = await prisma.game.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { players: true, answers: true } } },
  });
  res.json({ ok: true, games: games.map(g => ({
    id: g.id, pin: g.pin, status: g.status, createdAt: g.createdAt, endedAt: g.endedAt,
    players: g._count.players, answers: g._count.answers })) });
});

// Full results as JSON.
results.get("/results/:gameId.json", async (req, res) => {
  if (!authed(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const r = await computeResults(req.params.gameId);
  if (!r) return res.status(404).json({ ok: false, error: "Game not found" });
  res.setHeader("Content-Disposition", `attachment; filename="srk-quiz-${r.game.pin}.json"`);
  res.json({ ok: true, pin: r.game.pin, createdAt: r.game.createdAt, endedAt: r.game.endedAt,
    leaderboard: r.ranked, answers: r.answers });
});

// Leaderboard summary as CSV (one row per player).
results.get("/results/:gameId/leaderboard.csv", async (req, res) => {
  if (!authed(req)) return res.status(401).send("Unauthorized");
  const r = await computeResults(req.params.gameId);
  if (!r) return res.status(404).send("Game not found");
  const nameById = new Map(r.players.map(p => [p.id, p]));
  const header = ["Rank", "Name", "City", "Score", "Correct", "Wrong", "Accuracy %", "Total Time (s)", "Fastest (s)", "Best Streak"];
  const rows = r.ranked.map(x => {
    const p = nameById.get(x.playerId);
    const answered = x.correct + x.wrong;
    return [x.rank, x.name, p?.city ?? "", x.score, x.correct, x.wrong,
      answered ? Math.round((x.correct / answered) * 100) : 0,
      (x.totalMs / 1000).toFixed(3),
      x.fastestCorrectMs === null ? "" : (x.fastestCorrectMs / 1000).toFixed(3),
      x.bestStreak];
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="srk-quiz-${r.game.pin}-leaderboard.csv"`);
  res.send(csv([header, ...rows]));
});

// Every individual answer as CSV (per player, per question, with response time).
results.get("/results/:gameId/answers.csv", async (req, res) => {
  if (!authed(req)) return res.status(401).send("Unauthorized");
  const r = await computeResults(req.params.gameId);
  if (!r) return res.status(404).send("Game not found");
  const nameById = new Map(r.players.map(p => [p.id, p]));
  const header = ["Player", "City", "QuestionId", "SelectedOption", "Correct", "ResponseTime (s)", "Timestamp"];
  const rows = r.answers.map(a => {
    const p = nameById.get(a.playerId);
    return [p?.name ?? a.playerId, p?.city ?? "", a.questionId, a.selectedIndex + 1,
      a.isCorrect ? "YES" : "NO", (a.responseMs / 1000).toFixed(3), a.createdAt.toISOString()];
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="srk-quiz-${r.game.pin}-answers.csv"`);
  res.send(csv([header, ...rows]));
});
