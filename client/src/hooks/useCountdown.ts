import { useEffect, useState } from "react";
export function useCountdown(endsAt?: number, paused?: boolean) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!endsAt) return; let raf = 0;
    const loop = () => { setMs(Math.max(0, endsAt - Date.now())); raf = requestAnimationFrame(loop); };
    if (!paused) raf = requestAnimationFrame(loop); else setMs(Math.max(0, endsAt - Date.now()));
    return () => cancelAnimationFrame(raf);
  }, [endsAt, paused]);
  return ms;
}
