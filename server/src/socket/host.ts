import type { Server, Socket } from "socket.io";
import type { GameManager } from "../services/gameManager";
import { verifyHost } from "../routes/auth";
import { DEFAULT_SETTINGS } from "../../../shared/types";

type Rooms = { room: (g: string) => string; hostRoom: (g: string) => string };

export function registerHost(io: Server, gm: GameManager, socket: Socket, r: Rooms) {
  socket.on("host:create", async (p, ack) => {
    if (!verifyHost(p.token)) return ack({ ok: false, error: "Unauthorized" });
    const game = await gm.createGame({ ...DEFAULT_SETTINGS, ...p.settings });
    socket.join(r.hostRoom(game.id));
    ack({ ok: true, pin: game.pin, gameId: game.id });
  });

  socket.on("host:attach", (p, ack) => {
    if (!verifyHost(p.token)) return ack({ ok: false, error: "Unauthorized" });
    const g = gm.getGame(p.gameId);
    if (!g) return ack({ ok: false, error: "Game not found" });
    socket.join(r.hostRoom(p.gameId));
    ack({ ok: true, state: {
      status: g.status, pin: g.pin, currentIndex: g.currentIndex, total: g.questions.length,
      players: gm.publicPlayers(g), paused: g.paused } });
  });

  socket.on("host:control", async (p, ack) => {
    if (!verifyHost(p.token)) return ack({ ok: false, error: "Unauthorized" });
    try {
      switch (p.action) {
        case "start": await gm.start(p.gameId); break;
        case "next": gm.next(p.gameId); break;
        case "prev": gm.prev(p.gameId); break;
        case "skip": gm.skip(p.gameId); break;
        case "reveal": gm.reveal(p.gameId); break;
        case "restartQ": gm.restartQ(p.gameId); break;
        case "pause": gm.pause(p.gameId); break;
        case "resume": gm.resume(p.gameId); break;
        case "addTime": gm.addTime(p.gameId, p.value ?? 10); break;
        case "subTime": gm.subTime(p.gameId, p.value ?? 10); break;
        case "showBoard": gm.showBoard(p.gameId); break;
        case "hideBoard": gm.hideBoard(p.gameId); break;
        case "end": await gm.end(p.gameId); break;
      }
      ack({ ok: true });
    } catch (e: any) { ack({ ok: false, error: e.message }); }
  });
}
