import { motion, AnimatePresence } from "framer-motion";
import type { LeaderboardRow } from "../lib/types";
import { ms2s, pct } from "../lib/format";
const medal = ["#f0c75e", "#cbd5e1", "#d08b3c"];
export default function Leaderboard({ rows, max = 10, highlight }: { rows: LeaderboardRow[]; max?: number; highlight?: string }) {
  return (
    <div className="space-y-2">
      <AnimatePresence>
        {rows.slice(0, max).map((r) => {
          const mine = !!highlight && r.name === highlight;
          return (
          <motion.div layout key={r.playerId} initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            className={`glass flex items-center gap-3 px-4 py-3 ${mine ? "ring-2 ring-gold-300" : ""}`}
            style={{ borderColor: r.rank <= 3 ? medal[r.rank - 1] : undefined }}>
            <span className="font-bebas text-2xl w-9 shrink-0" style={{ color: r.rank <= 3 ? medal[r.rank - 1] : "#faf6ea" }}>#{r.rank}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{r.name}</div>
              <div className="text-cream-dim text-xs mt-0.5">⏱ {ms2s(r.totalMs)} · {pct(r.accuracy)} correct</div>
            </div>
            <span className="font-bebas text-2xl gold-text shrink-0">{r.score}</span>
          </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
