import { motion } from "framer-motion";
import { OPTION_STYLES } from "../lib/theme";
export default function AnswerBarChart({ distribution, correctIndex }:
  { distribution: number[]; correctIndex: number }) {
  const max = Math.max(1, ...distribution);
  return (
    <div className="flex items-end gap-4 h-40">
      {distribution.map((n, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <motion.div initial={{ height: 0 }} animate={{ height: `${(n / max) * 100}%` }}
            transition={{ duration: 0.6 }} className="w-full rounded-t-lg relative"
            style={{ background: OPTION_STYLES[i].bg, outline: i === correctIndex ? "3px solid #4ade80" : "none" }}>
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 font-bebas text-xl">{n}</span>
          </motion.div>
          <span className="text-2xl">{OPTION_STYLES[i].shape}</span>
        </div>
      ))}
    </div>
  );
}
