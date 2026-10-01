import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSolo } from "../store/soloStore";
import { useCountdown } from "../hooks/useCountdown";
import CircularTimer from "../components/CircularTimer";
import OptionCard from "../components/OptionCard";
import ParticleBg from "../components/ParticleBg";

const QUESTION_MS = 30000;
const isFeud = (c?: string) => (c || "").trim().toLowerCase() === "fan feud";

export default function SoloPlay() {
  const nav = useNavigate();
  const s = useSolo();
  // Client-local per-question deadline, set during render the moment a new
  // question appears. Using the server's absolute endsAt vs the client clock
  // caused instant time-outs (and skipped Q1) when the client clock ran ahead.
  const deadline = useRef<{ id?: string; at: number }>({ at: Date.now() + QUESTION_MS });
  if (s.question && deadline.current.id !== s.question.id) {
    deadline.current = { id: s.question.id, at: Date.now() + QUESTION_MS };
  }
  const remaining = useCountdown(deadline.current.at, false);
  const busy = useRef(false);
  const timedOutFor = useRef<string | null>(null);

  useEffect(() => {
    if (!s.sessionId || !s.question) nav("/solo");
  }, []);

  const submit = async (index: number) => {
    const q = useSolo.getState().question;
    if (!q || busy.current) return;
    busy.current = true;
    useSolo.getState().set({ myAnswers: { ...useSolo.getState().myAnswers, [q.index]: index } });
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/solo/answer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: useSolo.getState().sessionId, questionId: q.id, index }),
      });
      const d = await res.json();
      if (!d.ok) { nav("/solo"); return; }
      if (d.done) {
        useSolo.getState().set({ over: { result: d.result, rank: d.rank, total: d.total, answerKey: d.answerKey } });
        nav("/solo/end");
      } else {
        useSolo.getState().set({ question: d.question, endsAt: d.endsAt });
        busy.current = false;
      }
    } catch { busy.current = false; }
  };

  // auto-submit as "no answer" when the timer runs out
  const q = s.question;
  useEffect(() => {
    if (!q) return;
    if (remaining <= 0 && !busy.current && timedOutFor.current !== q.id) {
      timedOutFor.current = q.id;
      submit(-1);
    }
  }, [remaining, q?.id]);

  if (!q) return <div className="min-h-dvh flex items-center justify-center"><p>Loading…</p></div>;
  const selected = s.myAnswers[q.index];
  return (
    <div className="relative min-h-dvh p-4 flex flex-col z-10">
      <ParticleBg />
      <div className="z-10 flex items-center justify-between mb-2">
        <span className="font-bebas text-xl">Q{q.index + 1}/{q.total}</span>
        <CircularTimer remainingMs={remaining} totalMs={30000} size={90} />
        <span className="font-bebas text-xl text-cream-soft">SOLO</span>
      </div>
      {isFeud(q.category) && (
        <div className="z-10 text-center mt-2">
          <span className="inline-block text-xs font-bebas tracking-widest px-3 py-1 rounded-full bg-gold-700/30 border border-gold-300 text-gold-100">
            🗳️ FAN FEUD · pick the fan favourite
          </span>
        </div>
      )}
      <h1 className="z-10 font-cinzel text-2xl text-center my-4">{q.text}</h1>
      <div className="z-10 grid gap-3 flex-1 content-center">
        {q.options.map((o, i) => (
          <OptionCard key={i} index={i} text={o} disabled={busy.current}
            onClick={() => submit(i)} state={i === selected ? "selected" : "idle"} />
        ))}
      </div>
    </div>
  );
}
