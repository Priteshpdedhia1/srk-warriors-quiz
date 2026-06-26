import { useEffect, useRef } from "react";
import { sfx } from "../store/audioStore";
export default function CircularTimer({ remainingMs, totalMs, size = 140 }:
  { remainingMs: number; totalMs: number; size?: number }) {
  const frac = Math.max(0, Math.min(1, remainingMs / totalMs));
  const sec = Math.ceil(remainingMs / 1000);
  const r = size / 2 - 10, c = 2 * Math.PI * r;
  const color = sec > totalMs / 1000 * 0.5 ? "#15803d" : sec > 10 ? "#f0c75e" : sec > 5 ? "#d4750a" : "#a31010";
  const last = useRef(-1);
  useEffect(() => { if (sec <= 5 && sec >= 1 && sec !== last.current) { sfx.tick(); last.current = sec; } }, [sec]);
  return (
    <svg width={size} height={size} className="drop-shadow-[0_0_12px_rgba(240,199,94,.4)]">
      <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,.1)" strokeWidth="10" fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth="10" fill="none"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset .25s linear, stroke .3s" }} />
      <text x="50%" y="54%" textAnchor="middle" className="font-bebas" fontSize={size*0.32} fill="#faf6ea">{sec}</text>
    </svg>
  );
}
