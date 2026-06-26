import { useEffect } from "react";
import { useGame } from "../store/gameStore";
import Podium from "../components/Podium";
import Fireworks from "../components/Fireworks";
import Leaderboard from "../components/Leaderboard";
import ParticleBg from "../components/ParticleBg";
import { sfx } from "../store/audioStore";
export default function HostEnd() {
  const over = useGame(s => s.over);
  useEffect(() => { sfx.victory(); setTimeout(() => sfx.applause(), 800); }, []);
  if (!over) return <div className="min-h-dvh flex items-center justify-center">No results.</div>;
  return (
    <div className="relative min-h-dvh p-6 z-10">
      <ParticleBg /><Fireworks />
      <div className="z-10 relative">
        <h1 className="font-cinzel text-5xl gold-text text-center mb-2">🏆 Champions 🏆</h1>
        <div className="my-10"><Podium rows={over.podium} /></div>
        <div className="max-w-3xl mx-auto"><Leaderboard rows={over.fullRanking} max={20} /></div>
      </div>
    </div>
  );
}
