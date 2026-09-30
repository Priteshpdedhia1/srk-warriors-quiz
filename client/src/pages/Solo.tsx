import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSolo } from "../store/soloStore";
import GlassCard from "../components/GlassCard";
import GoldButton from "../components/GoldButton";
import ParticleBg from "../components/ParticleBg";
import SrkLogo from "../components/SrkLogo";

export default function Solo() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/solo/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await res.json();
      if (!d.ok) { setErr(d.error ?? "Could not start"); setBusy(false); return; }
      useSolo.getState().reset();
      useSolo.getState().set({ sessionId: d.sessionId, name: name.trim(),
        question: d.question, endsAt: d.endsAt, total: d.total });
      nav("/solo/play");
    } catch { setErr("Could not reach the server"); setBusy(false); }
  };

  return (
    <div className="relative min-h-dvh flex items-center justify-center p-6">
      <ParticleBg />
      <GlassCard className="z-10 w-full max-w-sm flex flex-col items-center">
        <SrkLogo size={100} />
        <h2 className="font-cinzel text-2xl gold-text text-center mb-1 mt-3">Take the Quiz</h2>
        <p className="text-cream-dim text-sm text-center mb-5">20 questions · 30s each · one attempt</p>
        <form onSubmit={start} className="space-y-3 w-full">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required
            className="w-full bg-ink-700 border border-gold-500/40 rounded-xl px-4 py-3 outline-none focus:border-gold-300" />
          {err && <p className="text-ruby text-sm text-center">{err}</p>}
          <div className="text-center"><GoldButton type="submit" disabled={busy || !name.trim()}>{busy ? "Starting…" : "START"}</GoldButton></div>
        </form>
        <button onClick={() => nav("/leaderboard")} className="text-gold-300 underline text-sm mt-4">View Leaderboard →</button>
      </GlassCard>
    </div>
  );
}
