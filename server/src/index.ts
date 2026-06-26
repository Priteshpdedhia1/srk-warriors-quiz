import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./env";
import { health } from "./routes/health";
import { auth } from "./routes/auth";
import { prisma } from "./db";
import { GameManager } from "./services/gameManager";
import { registerSockets } from "./socket";
import { ensureSeed } from "./services/ensureSeed";

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN.split(",") }));
app.use(express.json());
app.use(health);
app.use(auth);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: env.CORS_ORIGIN.split(",") } });

const gm = new GameManager({
  loadQuestions: async () => {
    const qs = await prisma.question.findMany({ orderBy: { order: "asc" } });
    return qs.map(q => ({ id: q.id, text: q.text, options: q.options as string[],
      correctIndex: q.correctIndex, explanation: q.explanation,
      difficulty: q.difficulty, category: q.category, posterUrl: q.posterUrl, imageUrl: q.imageUrl }));
  },
  persist: {
    game: async (g) => { await prisma.game.create({ data: { id: g.id, pin: g.pin, settings: g.settings as any } }); },
    player: async (gameId, p) => {
      const row = await prisma.player.create({ data: { gameId, name: p.name, city: p.city, ip: p.ip } });
      return row.id;
    },
    answer: async (a) => { await prisma.answer.create({ data: a }).catch(() => {}); },
    end: async (gameId) => { await prisma.game.update({ where: { id: gameId }, data: { status: "ENDED", endedAt: new Date() } }); },
  },
});

registerSockets(io, gm);
ensureSeed(prisma)
  .catch((e) => console.error("ensureSeed failed (continuing):", e))
  .finally(() => httpServer.listen(env.PORT, () => console.log(`server on :${env.PORT}`)));
