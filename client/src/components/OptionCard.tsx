import { motion } from "framer-motion";
import { OPTION_STYLES } from "../lib/theme";
export default function OptionCard({ index, text, onClick, disabled, state }:
  { index: number; text: string; onClick?: () => void; disabled?: boolean;
    state?: "idle" | "selected" | "correct" | "wrong" | "dim" }) {
  const s = OPTION_STYLES[index];
  const ring = state === "correct" ? "ring-4 ring-green-400" : state === "wrong" ? "ring-4 ring-red-400"
    : state === "selected" ? "ring-4 ring-gold-100" : "";
  return (
    <motion.button whileTap={{ scale: 0.96 }} disabled={disabled} onClick={onClick}
      className={`flex items-center gap-4 w-full p-5 rounded-2xl text-left text-white font-semibold
        text-lg md:text-2xl shadow-lg transition ${ring} ${state === "dim" ? "opacity-40" : ""}`}
      style={{ background: s.bg }}>
      <span className="text-3xl md:text-4xl drop-shadow">{s.shape}</span>
      <span className="flex-1">{text}</span>
    </motion.button>
  );
}
