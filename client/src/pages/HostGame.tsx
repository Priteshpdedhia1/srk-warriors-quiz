import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../socket/socket";
import { getToken } from "../hooks/useHostAuth";
import { useGame } from "../store/gameStore";
import { useCountdown } from "../hooks/useCountdown";
import { sfx } from "../store/audioStore";
import CircularTimer from "../components/CircularTimer";
import OptionCard from "../components/OptionCard";
import Controls from "../components/Controls";
import Leaderboard from "../components/Leaderboard";
import AnswerBarChart from "../components/AnswerBarChart";
import ParticleBg from "../components/ParticleBg";
import SrkLogo from "../components/SrkLogo";
import { useSettings } from "../store/settingsStore";

export default function HostGame() {
  const { gameId = "" } = useParams(); const nav = useNavigate();
  const g = useGame(); const timerSec = 30;
  const remaining = useCountdown(g.endsAt, g.paused);

  useEffect(() => {
    socket.emit("host:attach", { token: getToken(), gameId }, () => {});
    const onShow = (p: any) => useGame.getState().set({ question: p.question, endsAt: p.endsAt, paused: p.paused, reveal: undefined, boardVisible: false });
    const onTick = (p: any) => useGame.getState().set({ endsAt: p.paused ? undefined : Date.now() + p.remainingMs, paused: p.paused });
    const onReveal = (p: any) => { useGame.getState().set({ reveal: p }); sfx.applause(); };
    const onAnalytics = (p: any) => useGame.getState().set({ analytics: p });
    const onBoard = (p: any) => useGame.getState().set({ leaderboard: p.rows, boardVisible: true });
    const onHide = () => useGame.getState().set({ boardVisible: false });
    const onOver = (p: any) => { useGame.getState().set({ over: p }); nav(`/host/end/${gameId}`); };
    socket.on("question:show", onShow); socket.on("timer:tick", onTick);
    socket.on("question:reveal", onReveal); socket.on("host:analytics", onAnalytics);
    socket.on("leaderboard:show", onBoard); socket.on("leaderboard:hide", onHide);
    socket.on("game:over", onOver);
    return () => { socket.off("question:show", onShow); socket.off("timer:tick", onTick);
      socket.off("question:reveal", onReveal); socket.off("host:analytics", onAnalytics);
      socket.off("leaderboard:show", onBoard); socket.off("leaderboard:hide", onHide);
      socket.off("game:over", onOver); };
  }, [gameId]);

  const q = g.question;
  return (
    <div className="relative min-h-dvh p-6 flex flex-col z-10">
      <ParticleBg />
      <div className="fixed top-4 left-4 z-20 flex items-center gap-2">
        <SrkLogo size={52} />
        <button onClick={() => useSettings.getState().toggleMusic()} className="glass px-3 py-2">
          {useSettings(s => s.music) ? "🎵" : "🔇"}
        </button>
      </div>
      <div className="z-10 flex-1 flex flex-col">
        {g.boardVisible && g.leaderboard ? (
          <div className="max-w-3xl mx-auto w-full"><h2 className="font-cinzel text-4xl gold-text text-center mb-6">Leaderboard</h2><Leaderboard rows={g.leaderboard} /></div>
        ) : q ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="font-bebas text-3xl">Q{q.index + 1}/{q.total}</span>
              <CircularTimer remainingMs={g.paused ? 0 : remaining} totalMs={timerSec * 1000} />
              <span className="font-bebas text-2xl text-cream-soft">{g.analytics?.answered ?? 0} answered · {Math.round(g.analytics?.liveAccuracy ?? 0)}%</span>
            </div>
            <h1 className="font-cinzel text-3xl md:text-5xl text-center my-6">{q.text}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
              {q.options.map((o, i) => (
                <OptionCard key={i} index={i} text={o} disabled
                  state={g.reveal ? (i === g.reveal.correctIndex ? "correct" : "dim") : "idle"} />
              ))}
            </div>
            {g.reveal && (
              <div className="max-w-3xl mx-auto w-full mt-6 glass p-5">
                <p className="text-cream-soft mb-3">💡 {g.reveal.explanation} — <b>{Math.round(g.reveal.pctCorrect)}% correct</b></p>
                <AnswerBarChart distribution={g.reveal.distribution} correctIndex={g.reveal.correctIndex} />
              </div>
            )}
          </>
        ) : <p className="text-center mt-20 text-cream-dim">Waiting…</p>}
        <div className="mt-auto pt-6"><Controls gameId={gameId} /></div>
      </div>
    </div>
  );
}
