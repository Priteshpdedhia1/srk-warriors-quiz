import { describe, it, expect } from "vitest";
import { resolveRanking, RankInput } from "./ranking";

const mk = (id: string, o: Partial<RankInput>): RankInput => ({
  playerId: id, name: id, score: 0, totalMs: 0, fastestCorrectMs: null,
  bestStreak: 0, completedAt: 0, correct: 0, wrong: 0, ...o,
});

describe("resolveRanking", () => {
  it("ranks by score descending", () => {
    const r = resolveRanking([mk("a", { score: 2 }), mk("b", { score: 5 })]);
    expect(r.map(x => x.playerId)).toEqual(["b", "a"]);
    expect(r[0].rank).toBe(1);
  });
  it("breaks score tie by lower totalMs", () => {
    const r = resolveRanking([mk("a", { score: 5, totalMs: 9000 }), mk("b", { score: 5, totalMs: 4000 })]);
    expect(r[0].playerId).toBe("b");
  });
  it("breaks remaining tie by fastest single correct answer", () => {
    const r = resolveRanking([
      mk("a", { score: 5, totalMs: 5000, fastestCorrectMs: 2000 }),
      mk("b", { score: 5, totalMs: 5000, fastestCorrectMs: 1000 }),
    ]);
    expect(r[0].playerId).toBe("b");
  });
  it("then by longest streak, then earliest completion; assigns joint ranks", () => {
    const r = resolveRanking([
      mk("a", { score: 5, totalMs: 5000, fastestCorrectMs: 1000, bestStreak: 3, completedAt: 100 }),
      mk("b", { score: 5, totalMs: 5000, fastestCorrectMs: 1000, bestStreak: 3, completedAt: 100 }),
    ]);
    expect(r[0].rank).toBe(1);
    expect(r[1].rank).toBe(1); // joint
  });
});
