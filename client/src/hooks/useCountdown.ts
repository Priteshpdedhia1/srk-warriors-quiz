import { useEffect, useState } from "react";
export function useCountdown(endsAt?: number, paused?: boolean) {
  // Initialize from endsAt so the very first render isn't 0 (which previously
  // tripped SoloPlay's auto-timeout and skipped Q1).
  const [ms, setMs] = useState(() => (endsAt ? Math.max(0, endsAt - Date.now()) : 0));
  useEffect(() => {
    if (!endsAt) return; let raf = 0;
    const loop = () => { setMs(Math.max(0, endsAt - Date.now())); raf = requestAnimationFrame(loop); };
    if (!paused) raf = requestAnimationFrame(loop); else setMs(Math.max(0, endsAt - Date.now()));
    return () => cancelAnimationFrame(raf);
  }, [endsAt, paused]);
  return ms;
}
