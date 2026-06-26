import type { Server } from "socket.io";
import type { GameManager } from "../services/gameManager";
import { registerPlayer } from "./player";
import { registerHost } from "./host";

const room = (gameId: string) => `game:${gameId}`;
const hostRoom = (gameId: string) => `host:${gameId}`;

export function registerSockets(io: Server, gm: GameManager) {
  gm.on("lobby:update", (gid, p) => { io.to(room(gid)).emit("lobby:update", p); io.to(hostRoom(gid)).emit("lobby:update", p); });
  gm.on("question:show", (gid, p) => { io.to(room(gid)).emit("question:show", p); io.to(hostRoom(gid)).emit("question:show", p); });
  gm.on("timer:tick", (gid, p) => { io.to(room(gid)).emit("timer:tick", p); io.to(hostRoom(gid)).emit("timer:tick", p); });
  gm.on("question:reveal", (gid, p) => { io.to(room(gid)).emit("question:reveal", p); io.to(hostRoom(gid)).emit("question:reveal", p); });
  gm.on("leaderboard:show", (gid, p) => { io.to(room(gid)).emit("leaderboard:show", p); io.to(hostRoom(gid)).emit("leaderboard:show", p); });
  gm.on("leaderboard:hide", (gid) => { io.to(room(gid)).emit("leaderboard:hide"); io.to(hostRoom(gid)).emit("leaderboard:hide"); });
  gm.on("game:over", (gid, p) => { io.to(room(gid)).emit("game:over", p); io.to(hostRoom(gid)).emit("game:over", p); });
  gm.on("host:analytics", (gid, p) => { io.to(hostRoom(gid)).emit("host:analytics", p); });
  gm.on("player:scored", (_gid, playerId, p) => { io.to(`player:${playerId}`).emit("player:scored", p); });

  io.on("connection", (socket) => {
    registerPlayer(io, gm, socket, { room, hostRoom });
    registerHost(io, gm, socket, { room, hostRoom });
    socket.on("disconnect", () => gm.disconnectSocket(socket.id));
  });
}
