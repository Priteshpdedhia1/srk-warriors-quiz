import type { Server, Socket } from "socket.io";
import type { GameManager } from "../services/gameManager";

type Rooms = { room: (g: string) => string; hostRoom: (g: string) => string };

export function registerPlayer(io: Server, gm: GameManager, socket: Socket, r: Rooms) {
  socket.on("player:join", async (p, ack) => {
    try {
      const game = gm.getGameByPin(p.pin);
      if (!game) return ack({ ok: false, error: "Game not found" });
      const ip = socket.handshake.address;
      const player = await gm.addPlayer(game.id, { name: p.name, city: p.city, socketId: socket.id, ip });
      socket.join(r.room(game.id));
      socket.join(`player:${player.id}`);
      (socket.data as any).gameId = game.id; (socket.data as any).playerId = player.id;
      ack({ ok: true, playerId: player.id, state: {
        status: game.status, alreadyAnswered: false, score: 0, streak: 0 } });
    } catch (e: any) { ack({ ok: false, error: e.message }); }
  });

  socket.on("player:reconnect", (p, ack) => {
    const res = gm.reconnectByPlayer(p.playerId, socket.id);
    if (!res) return ack({ ok: false, error: "Player not found" });
    socket.join(r.room(res.gameId));
    socket.join(`player:${p.playerId}`);
    (socket.data as any).gameId = res.gameId; (socket.data as any).playerId = p.playerId;
    ack({ ok: true, state: res.state });
  });

  socket.on("answer:submit", async (p, ack) => {
    const gameId = (socket.data as any).gameId; const playerId = (socket.data as any).playerId;
    if (!gameId || !playerId) return ack({ ok: false, error: "Not in a game" });
    const res = await gm.submitAnswer(gameId, playerId, p.questionId, p.index);
    if (res.ok) ack({ ok: true, locked: true }); else ack(res);
  });
}
