import { useEffect } from "react";
import confetti from "canvas-confetti";
export default function Fireworks() {
  useEffect(() => {
    const end = Date.now() + 4000;
    const tick = () => {
      confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0 }, colors: ["#f0c75e","#faf6ea","#a31010"] });
      confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1 }, colors: ["#f0c75e","#faf6ea","#a31010"] });
      if (Date.now() < end) requestAnimationFrame(tick);
    }; tick();
  }, []);
  return null;
}
