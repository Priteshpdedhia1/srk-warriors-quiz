import { motion, AnimatePresence } from "framer-motion";
import type { LeaderboardRow } from "../lib/types";
import { ms2s, pct } from "../lib/format";
const medal = ["#f0c75e", "#cbd5e1", "#d08b3c"];
export default function Leaderboard({ rows, max = 10 }: { rows: LeaderboardRow[]; max?: number }) {
  return (
    <div className="space-y-2">
      <AnimatePresence>
        {rows.slice(0, max).map((r) => (
          <motion.div layout key={r.playerId} initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            className="glass flex items-center gap-4 px-4 py-3"
            style={{ borderColor: r.rank <= 3 ? medal[r.rank - 1] : undefined }}>
            <span className="font-bebas text-2xl w-10" style={{ color: r.rank <= 3 ? medal[r.rank - 1] : "#faf6ea" }}>#{r.rank}</span>
            <span className="flex-1 font-semibold truncate">{r.name}</span>
            <span className="text-cream-dim text-sm hidden md:inline">{pct(r.accuracy)} · {ms2s(r.totalMs)}</span>
            <span className="font-bebas text-2xl gold-text">{r.score}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
