import { io, Socket } from "socket.io-client";
import type { ClientToServer, ServerToClient } from "../lib/types";
const URL = import.meta.env.VITE_SERVER_URL as string;
export const socket: Socket<ServerToClient, ClientToServer> =
  io(URL, { autoConnect: true, transports: ["websocket"] });
