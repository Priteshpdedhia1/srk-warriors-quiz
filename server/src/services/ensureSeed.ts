import type { PrismaClient } from "@prisma/client";
import { QUESTIONS } from "../../prisma/questions";

// Inserts the question bank only when the table is empty. Safe to run on every
// boot — it never deletes existing questions (unlike the CLI seed).
export async function ensureSeed(prisma: PrismaClient): Promise<number> {
  const existing = await prisma.question.count();
  if (existing > 0) return existing;
  await Promise.all(QUESTIONS.map((q, i) =>
    prisma.question.create({ data: { ...q, order: i } })));
  console.log(`Auto-seeded ${QUESTIONS.length} questions`);
  return QUESTIONS.length;
}
