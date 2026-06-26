import { motion } from "framer-motion";
import type { LeaderboardRow } from "../lib/types";
const H = [180, 240, 140], ORD = [1, 0, 2], MEDAL = ["#cbd5e1","#f0c75e","#d08b3c"], LABEL=["Runner-up","Champion","2nd Runner-up"];
export default function Podium({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="flex items-end justify-center gap-4">
      {ORD.map((idx, pos) => { const r = rows[idx]; if (!r) return null; return (
        <motion.div key={r.playerId} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: pos * 0.25 }} className="flex flex-col items-center">
          <div className="font-cinzel text-xl gold-text mb-1">{LABEL[idx]}</div>
          <div className="font-bold text-2xl mb-2">{r.name}</div>
          <div className="w-28 rounded-t-xl flex items-start justify-center pt-3 font-bebas text-4xl text-ink-900"
            style={{ height: H[idx], background: `linear-gradient(180deg, ${MEDAL[idx]}, #b8860b)` }}>{r.score}</div>
        </motion.div>); })}
    </div>
  );
}
