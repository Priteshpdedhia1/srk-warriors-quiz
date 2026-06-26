import { describe, it, expect } from "vitest";
import { scoreAnswer, aggregatePlayer } from "./scoring";

describe("scoreAnswer", () => {
  it("correct answer earns 1 point and increments streak", () => {
    expect(scoreAnswer({ score: 3, streak: 2, bestStreak: 2 }, true))
      .toEqual({ score: 4, streak: 3, bestStreak: 3 });
  });
  it("wrong answer earns 0 and resets streak, keeps bestStreak", () => {
    expect(scoreAnswer({ score: 3, streak: 5, bestStreak: 5 }, false))
      .toEqual({ score: 3, streak: 0, bestStreak: 5 });
  });
});

describe("aggregatePlayer", () => {
  it("computes totals from a list of answers", () => {
    const ans = [
      { isCorrect: true, responseMs: 3000 },
      { isCorrect: false, responseMs: 9000 },
      { isCorrect: true, responseMs: 4000 },
    ];
    const a = aggregatePlayer(ans);
    expect(a.correct).toBe(2);
    expect(a.wrong).toBe(1);
    expect(a.totalMs).toBe(16000);
    expect(a.fastestCorrectMs).toBe(3000);
    expect(a.accuracy).toBeCloseTo(66.6667, 2);
  });
  it("fastestCorrectMs is null when no correct answers", () => {
    expect(aggregatePlayer([{ isCorrect: false, responseMs: 5000 }]).fastestCorrectMs).toBeNull();
  });
});
