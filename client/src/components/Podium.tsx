import { motion } from "framer-motion";
import type { LeaderboardRow } from "../lib/types";

// Visual podium slots, left -> center -> right. Each slot pulls a row by its rank
// (rowIdx) and carries its own label/height/medal, so the labels always match the
// ranking: center = rank 1 (Champion, tallest, gold).
const SLOTS = [
  { rowIdx: 1, label: "Runner-up",     h: 180, medal: "#cbd5e1" }, // left  (rank 2, silver)
  { rowIdx: 0, label: "Champion",      h: 240, medal: "#f0c75e" }, // center(rank 1, gold)
  { rowIdx: 2, label: "2nd Runner-up", h: 140, medal: "#d08b3c" }, // right (rank 3, bronze)
];

export default function Podium({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="flex items-end justify-center gap-4">
      {SLOTS.map((s, pos) => {
        const r = rows[s.rowIdx];
        if (!r) return null;
        return (
          <motion.div key={r.playerId} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: pos * 0.25 }} className="flex flex-col items-center">
            <div className="font-cinzel text-xl gold-text mb-1">{s.label}</div>
            <div className="font-bold text-2xl mb-2">{r.name}</div>
            <div className="w-28 rounded-t-xl flex items-start justify-center pt-3 font-bebas text-4xl text-ink-900"
              style={{ height: s.h, background: `linear-gradient(180deg, ${s.medal}, #b8860b)` }}>{r.score}</div>
          </motion.div>
        );
      })}
    </div>
  );
}
