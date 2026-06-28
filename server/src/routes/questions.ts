import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { verifyHost } from "./auth";

export const questions = Router();

// Host-only. Token via Authorization: Bearer <jwt> or ?token=
function authed(req: any): boolean {
  const header = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return verifyHost((req.query.token as string) || header);
}

const qBody = z.object({
  text: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().default(""),
  difficulty: z.enum(["EASY", "MED", "HARD"]).default("MED"),
  category: z.string().default("General"),
});

const toDto = (q: any) => ({
  id: q.id, text: q.text, options: q.options as string[], correctIndex: q.correctIndex,
  explanation: q.explanation, difficulty: q.difficulty, category: q.category, order: q.order,
});

// List all questions (admin view — includes correctIndex)
questions.get("/questions", async (req, res) => {
  if (!authed(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const rows = await prisma.question.findMany({ orderBy: { order: "asc" } });
  res.json({ ok: true, questions: rows.map(toDto) });
});

// Create a new question (appended at the end)
questions.post("/questions", async (req, res) => {
  if (!authed(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const parsed = qBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" });
  const max = await prisma.question.aggregate({ _max: { order: true } });
  const row = await prisma.question.create({ data: { ...parsed.data, order: (max._max.order ?? -1) + 1 } });
  res.json({ ok: true, question: toDto(row) });
});

// Update a question
questions.put("/questions/:id", async (req, res) => {
  if (!authed(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const parsed = qBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" });
  try {
    const row = await prisma.question.update({ where: { id: req.params.id }, data: parsed.data });
    res.json({ ok: true, question: toDto(row) });
  } catch { res.status(404).json({ ok: false, error: "Question not found" }); }
});

// Delete a question
questions.delete("/questions/:id", async (req, res) => {
  if (!authed(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  try {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch { res.status(404).json({ ok: false, error: "Question not found" }); }
});
