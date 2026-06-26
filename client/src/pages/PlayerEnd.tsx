import { useGame } from "../store/gameStore";
import GlassCard from "../components/GlassCard";
import ParticleBg from "../components/ParticleBg";
import Fireworks from "../components/Fireworks";
import { ms2s, pct } from "../lib/format";
export default function PlayerEnd() {
  const { over, playerId, myAnswers } = useGame();
  const me = over?.fullRanking.find(r => r.playerId === playerId);
  const top3 = me ? me.rank <= 3 : false;
  return (
    <div className="relative min-h-dvh flex flex-col items-center p-6 gap-6">
      <ParticleBg />{top3 && <Fireworks />}
      <GlassCard className="z-10 text-center max-w-sm w-full">
        <div className="text-5xl mb-2">{top3 ? "🏆" : "👑"}</div>
        <h2 className="font-cinzel text-3xl gold-text mb-1">{me ? `Rank #${me.rank}` : "Thanks for playing!"}</h2>
        {me && <>
          <p className="font-bold text-xl">{me.name}</p>
          <div className="grid grid-cols-2 gap-3 mt-4 text-left">
            <Stat l="Score" v={String(me.score)} /><Stat l="Accuracy" v={pct(me.accuracy)} />
            <Stat l="Total Time" v={ms2s(me.totalMs)} /><Stat l="Best Streak" v={String(me.streak)} />
            <Stat l="Fastest" v={me.fastestMs ? ms2s(me.fastestMs) : "—"} /><Stat l="Correct" v={`${me.correct}/${me.correct + me.wrong}`} />
          </div>
        </>}
      </GlassCard>

      {over?.answerKey && (
        <div className="z-10 w-full max-w-sm">
          <h3 className="font-cinzel text-xl gold-text text-center mb-3">Your Answers</h3>
          <div className="space-y-2">
            {over.answerKey.map((q) => {
              const mine = myAnswers[q.index];
              const answered = mine !== undefined;
              const right = mine === q.correctIndex;
              return (
                <div key={q.index} className="glass p-3" style={{ borderColor: right ? "#4ade80" : "#f87171" }}>
                  <p className="text-sm font-semibold mb-1">{right ? "✅" : "❌"} Q{q.index + 1}. {q.text}</p>
                  {!right && (
                    <p className="text-red-400 text-sm">
                      Your answer: {answered ? q.options[mine] : "— no answer —"}
                    </p>
                  )}
                  <p className="text-green-400 text-sm">Correct: {q.options[q.correctIndex]}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
function Stat({ l, v }: { l: string; v: string }) {
  return <div className="glass px-3 py-2"><div className="text-cream-dim text-xs">{l}</div><div className="font-bebas text-2xl">{v}</div></div>;
}
