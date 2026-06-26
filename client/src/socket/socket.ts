import { io, Socket } from "socket.io-client";
import type { ClientToServer, ServerToClient } from "../lib/types";
const URL = import.meta.env.VITE_SERVER_URL as string;
export const socket: Socket<ServerToClient, ClientToServer> =
  io(URL, { autoConnect: true, transports: ["websocket"] });

// Reconnection + resume-on-reopen is handled by <ResumeWatcher/> (it needs router
// access to navigate the player back to the live screen).
