import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket/socket";
import { useGame } from "../store/gameStore";
import GlassCard from "../components/GlassCard";
import ParticleBg from "../components/ParticleBg";
import { motion } from "framer-motion";
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
      <GlassCard className="z-10 text-center">
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl mb-4">👑</motion.div>
        <h2 className="font-cinzel text-3xl gold-text mb-2">Waiting for Host…</h2>
        <p className="font-bebas text-2xl text-cream-soft">{count} players in the lobby</p>
      </GlassCard>
    </div>
  );
}
