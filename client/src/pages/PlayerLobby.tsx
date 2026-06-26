import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket/socket";
import { useGame } from "../store/gameStore";
import GlassCard from "../components/GlassCard";
import ParticleBg from "../components/ParticleBg";
import SrkLogo from "../components/SrkLogo";
export default function PlayerLobby() {
  const nav = useNavigate(); const [count, setCount] = useState(0);
  useEffect(() => {
    const onLobby = (p: { count: number }) => setCount(p.count);
    const onShow = (p: any) => { useGame.getState().set({ question: p.question, endsAt: p.endsAt, locked: false, selectedIndex: undefined, reveal: undefined }); nav("/play"); };
    socket.on("lobby:update", onLobby); socket.on("question:show", onShow);
    return () => { socket.off("lobby:update", onLobby); socket.off("question:show", onShow); };
  }, []);
  return (
    <div className="relative min-h-dvh flex items-center justify-center p-6">
      <ParticleBg />
      <GlassCard className="z-10 text-center flex flex-col items-center">
        <SrkLogo size={110} />
        <h2 className="font-cinzel text-3xl gold-text mb-2 mt-4">Waiting for Host…</h2>
        <p className="font-bebas text-2xl text-cream-soft">{count} players in the lobby</p>
      </GlassCard>
    </div>
  );
}
