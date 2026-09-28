import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSolo } from "../store/soloStore";
import GlassCard from "../components/GlassCard";
import ParticleBg from "../components/ParticleBg";
import Fireworks from "../components/Fireworks";
import GoldButton from "../components/GoldButton";
import { sfx } from "../store/audioStore";
import { ms2s, pct } from "../lib/format";

export default function SoloEnd() {
  const nav = useNavigate();
  const { over, myAnswers } = useSolo();
  const top3 = over?.rank ? over.rank <= 3 : false;

  useEffect(() => {
    if (!over) { nav("/solo"); return; }
    try { localStorage.setItem("srk-solo-played", over.result.name); } catch {}
    sfx.victory();
  }, []);

  if (!over) return null;
  const r = over.result;
  return (
    <div className="relative min-h-dvh flex flex-col items-center p-6 gap-6">
      <ParticleBg />{top3 && <Fireworks />}
      <GlassCard className="z-10 text-center max-w-sm w-full">
        <div className="text-5xl mb-2">{top3 ? "🏆" : "👑"}</div>
        <h2 className="font-cinzel text-3xl gold-text mb-1">
          {over.rank ? `Rank #${over.rank} of ${over.total}` : "Quiz Complete"}
        </h2>
        <p className="font-bold text-xl">{r.name}</p>
        <div className="grid grid-cols-2 gap-3 mt-4 text-left">
          <Stat l="Score" v={`${r.score}/${over.answerKey.length}`} /><Stat l="Accuracy" v={pct(r.accuracy)} />
          <Stat l="Total Time" v={ms2s(r.totalMs)} /><Stat l="Best Streak" v={String(r.bestStreak)} />
          <Stat l="Fastest" v={r.fastestMs ? ms2s(r.fastestMs) : "—"} /><Stat l="Correct" v={`${r.correct}/${r.correct + r.wrong}`} />
        </div>
        <div className="flex gap-3 justify-center mt-6">
          <GoldButton onClick={() => nav("/leaderboard")}>LEADERBOARD</GoldButton>
          <button onClick={() => nav("/")} className="glass px-6 py-3 font-semibold">Home</button>
        </div>
      </GlassCard>

      <div className="z-10 w-full max-w-sm">
        <h3 className="font-cinzel text-xl gold-text text-center mb-3">Your Answers</h3>
        <div className="space-y-2">
          {over.answerKey.map((q) => {
            const mine = myAnswers[q.index];
            const answered = mine !== undefined && mine >= 0;
            const right = mine === q.correctIndex;
            return (
              <div key={q.index} className="glass p-3" style={{ borderColor: right ? "#4ade80" : "#f87171" }}>
                <p className="text-sm font-semibold mb-1">{right ? "✅" : "❌"} Q{q.index + 1}. {q.text}</p>
                {!right && <p className="text-red-400 text-sm">Your answer: {answered ? q.options[mine] : "— no answer —"}</p>}
                <p className="text-green-400 text-sm">Correct: {q.options[q.correctIndex]}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function Stat({ l, v }: { l: string; v: string }) {
  return <div className="glass px-3 py-2"><div className="text-cream-dim text-xs">{l}</div><div className="font-bebas text-2xl">{v}</div></div>;
}
