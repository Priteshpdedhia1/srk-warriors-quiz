import { PrismaClient } from "@prisma/client";
import { QUESTIONS } from "./questions";
const prisma = new PrismaClient();
async function main() {
  await prisma.question.deleteMany();
  await Promise.all(QUESTIONS.map((q, i) =>
    prisma.question.create({ data: { ...q, order: i } })));
  console.log(`Seeded ${QUESTIONS.length} questions`);
}
main().finally(() => prisma.$disconnect());
