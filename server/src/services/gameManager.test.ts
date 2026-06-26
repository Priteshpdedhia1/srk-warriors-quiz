import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameManager } from "./gameManager";
import { DEFAULT_SETTINGS } from "../../../shared/types";

const QS = [
  { id: "q1", text: "Q1", options: ["a","b","c","d"], correctIndex: 1, explanation: "e1", difficulty: "EASY" as const, category: "x" },
  { id: "q2", text: "Q2", options: ["a","b","c","d"], correctIndex: 0, explanation: "e2", difficulty: "EASY" as const, category: "x" },
];

function newGM() {
  return new GameManager({
    loadQuestions: async () => QS,
    persist: { game: vi.fn(), player: vi.fn(async () => "pid"), answer: vi.fn(), end: vi.fn() },
  });
}

describe("GameManager", () => {
  beforeEach(() => vi.useFakeTimers());

  it("creates a game with a 6-digit pin and LOBBY status", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2 });
    expect(g.pin).toMatch(/^\d{6}$/);
    expect(g.status).toBe("LOBBY");
  });

  it("rejects duplicate names in same game", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2 });
    await gm.addPlayer(g.id, { name: "Raj", socketId: "s1" });
    await expect(gm.addPlayer(g.id, { name: "Raj", socketId: "s2" }))
      .rejects.toThrow(/name/i);
  });

  it("starting emits question:show with correctIndex stripped", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2, timerSec: 30 });
    const spy = vi.fn();
    gm.on("question:show", spy);
    await gm.start(g.id);
    const payload = spy.mock.calls[0][1];
    expect(payload.question).not.toHaveProperty("correctIndex");
    expect(payload.endsAt).toBeGreaterThan(Date.now());
  });

  it("scores a correct answer and blocks a second submission", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2, timerSec: 30 });
    const p = await gm.addPlayer(g.id, { name: "Raj", socketId: "s1" });
    await gm.start(g.id);
    const r1 = await gm.submitAnswer(g.id, p.id, "q1", 1);
    expect(r1.ok).toBe(true);
    const r2 = await gm.submitAnswer(g.id, p.id, "q1", 2);
    expect(r2).toEqual({ ok: false, error: expect.stringMatching(/already/i) });
    expect(gm.getPlayer(g.id, p.id)!.score).toBe(1);
  });

  it("emits question:reveal automatically when the timer expires", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2, timerSec: 1 });
    const reveal = vi.fn();
    gm.on("question:reveal", reveal);
    await gm.start(g.id);
    await vi.advanceTimersByTimeAsync(1100);
    expect(reveal).toHaveBeenCalledOnce();
    expect(reveal.mock.calls[0][1].correctIndex).toBe(1);
  });
});
