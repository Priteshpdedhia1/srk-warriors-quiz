import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import GlassCard from "../components/GlassCard";
import GoldButton from "../components/GoldButton";
import ParticleBg from "../components/ParticleBg";
import { useHostAuth } from "../hooks/useHostAuth";
export default function HostDashboard() {
  const nav = useNavigate(); const { require } = useHostAuth();
  useEffect(() => { require(); }, []);
  return (
    <div className="relative min-h-dvh flex items-center justify-center p-6">
      <ParticleBg />
      <GlassCard className="z-10 text-center">
        <h2 className="font-cinzel text-4xl gold-text mb-8">Host Dashboard</h2>
        <div className="grid gap-4">
          <GoldButton onClick={() => nav("/host/create")}>CREATE NEW GAME</GoldButton>
          <button onClick={() => nav("/host/questions")} className="glass px-8 py-3 hover:border-gold-300 transition font-semibold">📝 QUESTION MANAGER</button>
          <button onClick={() => nav("/host/results")} className="glass px-8 py-3 hover:border-gold-300 transition font-semibold">📊 EXPORT RESULTS</button>
          <button onClick={() => { localStorage.removeItem("srk-host-token"); nav("/"); }}
            className="text-gold-300 underline mt-2">Log out</button>
        </div>
      </GlassCard>
    </div>
  );
}
