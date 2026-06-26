import { socket } from "../socket/socket";
import { getToken } from "../hooks/useHostAuth";
import type { HostAction } from "../lib/types";
const BTNS: { a: HostAction; label: string; v?: number }[] = [
  { a: "pause", label: "⏸ Pause" }, { a: "resume", label: "▶ Resume" },
  { a: "prev", label: "⏮ Prev" }, { a: "skip", label: "⏭ Skip" },
  { a: "reveal", label: "👁 Reveal" }, { a: "restartQ", label: "↺ Restart Q" },
  { a: "addTime", label: "+10s", v: 10 }, { a: "subTime", label: "−10s", v: 10 },
  { a: "showBoard", label: "🏆 Board" }, { a: "hideBoard", label: "Hide Board" },
  { a: "next", label: "Next ➡" }, { a: "end", label: "⏹ End" },
];
export default function Controls({ gameId }: { gameId: string }) {
  const fire = (a: HostAction, v?: number) => socket.emit("host:control", { token: getToken(), gameId, action: a, value: v }, () => {});
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {BTNS.map(b => <button key={b.label} onClick={() => fire(b.a, b.v)}
        className="glass px-4 py-2 hover:border-gold-300 transition text-sm font-semibold">{b.label}</button>)}
    </div>
  );
}
