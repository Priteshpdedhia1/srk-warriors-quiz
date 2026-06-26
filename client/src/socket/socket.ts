import { io, Socket } from "socket.io-client";
import type { ClientToServer, ServerToClient } from "../lib/types";
const URL = import.meta.env.VITE_SERVER_URL as string;
export const socket: Socket<ServerToClient, ClientToServer> =
  io(URL, { autoConnect: true, transports: ["websocket"] });

socket.on("connect", () => {
  const raw = localStorage.getItem("srk-player");
  if (!raw) return;
  const { playerId } = JSON.parse(raw);
  socket.emit("player:reconnect", { playerId }, (r) => {
    if (!r.ok) return;
    import("../store/gameStore").then(({ useGame }) => useGame.getState().set({
      playerId, question: r.state.question, endsAt: r.state.endsAt,
      locked: r.state.alreadyAnswered, score: r.state.score, streak: r.state.streak }));
  });
});
