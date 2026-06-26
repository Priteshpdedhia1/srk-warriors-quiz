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

  it("auto-advances to the next question when the timer expires", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2, timerSec: 1 });
    const show = vi.fn();
    gm.on("question:show", show);
    await gm.start(g.id);
    expect(show).toHaveBeenCalledOnce(); // Q1
    await vi.advanceTimersByTimeAsync(1100);
    expect(show).toHaveBeenCalledTimes(2); // auto-advanced to Q2
    expect(show.mock.calls[1][1].question.index).toBe(1);
  });

  it("ends with a full answer key after the last question's timer expires", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2, timerSec: 1 });
    const over = vi.fn();
    gm.on("game:over", over);
    await gm.start(g.id);
    await vi.advanceTimersByTimeAsync(1100); // Q1 -> Q2
    await vi.advanceTimersByTimeAsync(1100); // Q2 -> end
    expect(over).toHaveBeenCalledOnce();
    const payload = over.mock.calls[0][1];
    expect(payload.answerKey).toHaveLength(2);
    expect(payload.answerKey[0].correctIndex).toBe(1);
    expect(payload.answerKey[1].correctIndex).toBe(0);
  });
});
