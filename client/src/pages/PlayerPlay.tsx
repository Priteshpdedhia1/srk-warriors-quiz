import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket/socket";
import { useGame } from "../store/gameStore";
import { useCountdown } from "../hooks/useCountdown";
import { sfx } from "../store/audioStore";
import CircularTimer from "../components/CircularTimer";
import OptionCard from "../components/OptionCard";
import ParticleBg from "../components/ParticleBg";

export default function PlayerPlay() {
  const nav = useNavigate(); const g = useGame();
  const remaining = useCountdown(g.endsAt, g.paused);

  useEffect(() => {
    history.pushState(null, "", location.href);
    const block = () => history.pushState(null, "", location.href);
    window.addEventListener("popstate", block);

    const onShow = (p: any) => useGame.getState().set({ question: p.question, endsAt: p.endsAt, locked: false, selectedIndex: undefined, reveal: undefined });
    const onReveal = (p: any) => { useGame.getState().set({ reveal: p });
      const sel = useGame.getState().selectedIndex;
      if (sel === p.correctIndex) sfx.correct(); else if (sel !== undefined) sfx.wrong(); };
    const onScored = (p: any) => useGame.getState().set({ score: p.score, streak: p.streak });
    const onOver = () => nav("/play/end");
    socket.on("question:show", onShow); socket.on("question:reveal", onReveal);
    socket.on("player:scored", onScored); socket.on("game:over", onOver);
    return () => { window.removeEventListener("popstate", block);
      socket.off("question:show", onShow); socket.off("question:reveal", onReveal);
      socket.off("player:scored", onScored); socket.off("game:over", onOver); };
  }, []);

  const answer = (i: number) => {
    if (g.locked || !g.question) return;
    useGame.getState().set({ selectedIndex: i, locked: true });
    socket.emit("answer:submit", { questionId: g.question.id, index: i }, (r) => {
      if (!r.ok) useGame.getState().set({ locked: false, selectedIndex: undefined });
    });
  };

  const q = g.question;
  if (!q) return <div className="min-h-dvh flex items-center justify-center"><p>Loading…</p></div>;
  const stateFor = (i: number) => {
    if (g.reveal) return i === g.reveal.correctIndex ? "correct" : i === g.selectedIndex ? "wrong" : "dim";
    return i === g.selectedIndex ? "selected" : "idle";
  };
  return (
    <div className="relative min-h-dvh p-4 flex flex-col z-10">
      <ParticleBg />
      <div className="z-10 flex items-center justify-between mb-2">
        <span className="font-bebas text-xl">Q{q.index + 1}/{q.total}</span>
        <CircularTimer remainingMs={g.paused ? 0 : remaining} totalMs={30000} size={90} />
        <span className="font-bebas text-xl">⭐{g.score} 🔥{g.streak}</span>
      </div>
      <h1 className="z-10 font-cinzel text-2xl text-center my-4">{q.text}</h1>
      <div className="z-10 grid gap-3 flex-1 content-center">
        {q.options.map((o, i) => (
          <OptionCard key={i} index={i} text={o} disabled={g.locked} onClick={() => answer(i)} state={stateFor(i) as any} />
        ))}
      </div>
      {g.locked && !g.reveal && (
        <p className="z-10 text-center font-cinzel text-xl gold-text mt-4">Answer Locked ✓ — Waiting for others…</p>
      )}
    </div>
  );
}
