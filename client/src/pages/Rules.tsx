// Rules: 20 questions, 30/40/30 mix, 2-3 fan-feud. (git auto-deploy verified)
import { useNavigate } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import ParticleBg from "../components/ParticleBg";
const RULES = [
  "20 questions, 30 seconds each. 1 point per correct answer.",
  "A balanced mix — roughly 30% easy, 40% medium, 30% hard.",
  "Every quiz has 2–3 Fan Feud questions — pure SRK fandom, no Googling or AI will help.",
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
        <button onClick={() => nav("/")} className="mt-6 underline text-gold-300">← Back</button>
      </GlassCard>
    </div>
  );
}
