// Rules: 20 questions, 30/40/30 mix, 2-3 fan-feud. (git auto-deploy verified)
import { useNavigate } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import ParticleBg from "../components/ParticleBg";
const RULES = [
  "20 questions, 30 seconds each. 1 point per correct answer.",
  "A balanced mix — roughly 30% easy, 40% medium, 30% hard.",
  "Every quiz has 2–3 Fan Feud questions — the un-Googleable test of a true fan (explained below).",
  "Answer fast — ties are broken by total response time.",
  "One attempt per name — make it count.",
  "Stay connected — you'll auto-reconnect if you drop.",
];
export default function Rules() {
  const nav = useNavigate();
  return (
    <div className="relative min-h-dvh flex items-center justify-center p-6">
      <ParticleBg />
      <GlassCard className="max-w-lg z-10">
        <h2 className="font-cinzel text-3xl gold-text mb-4">How to Play</h2>
        <ul className="space-y-3 text-cream-soft">{RULES.map((r, i) => <li key={i}>👑 {r}</li>)}</ul>
        <div className="mt-5 glass p-4 border border-gold-300">
          <p className="font-cinzel gold-text mb-1">🗳️ What's a Fan Feud question?</p>
          <p className="text-cream-dim text-sm leading-relaxed">
            These are opinion-style questions with no fact you can Google or ask an AI — like
            <i> "Most stylish SRK look?"</i> or <i>"Most romantic SRK character?"</i>. The correct answer is the
            <b className="text-cream"> fan-favourite</b> — the most popular pick among SRK Warriors. 2–3 show up in every
            quiz (look for the gold <b className="text-cream">🗳️ FAN FEUD</b> badge), so only true fans — not search engines — come out on top.
          </p>
        </div>
        <button onClick={() => nav("/")} className="mt-6 underline text-gold-300">← Back</button>
      </GlassCard>
    </div>
  );
}
