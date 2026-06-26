import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket/socket";
import { useGame } from "../store/gameStore";

// Restores a player's session after a tab close/refresh or a dropped connection.
// On every socket (re)connect it asks the server for the player's current state
// and routes them back to the right screen. Hosts have no "srk-player" entry, so
// this is a no-op for them.
export default function ResumeWatcher() {
  const nav = useNavigate();
  useEffect(() => {
    const resume = () => {
      const raw = localStorage.getItem("srk-player");
      if (!raw) return;
      let playerId: string;
      try { ({ playerId } = JSON.parse(raw)); } catch { return; }
      socket.emit("player:reconnect", { playerId }, (r) => {
        if (!r.ok) return; // game ended/expired — leave them wherever they are
        const s = r.state;
        useGame.getState().set({
          playerId, question: s.question, endsAt: s.endsAt,
          selectedIndex: undefined, locked: false, score: s.score, streak: s.streak,
        });
        const path = window.location.pathname;
        if (s.status === "RUNNING" || s.status === "REVEAL") {
          if (path !== "/play") nav("/play");
        } else if (s.status === "LOBBY") {
          if (path !== "/play/lobby") nav("/play/lobby");
        }
      });
    };
    if (socket.connected) resume();
    socket.on("connect", resume);
    return () => { socket.off("connect", resume); };
  }, [nav]);
  return null;
}
