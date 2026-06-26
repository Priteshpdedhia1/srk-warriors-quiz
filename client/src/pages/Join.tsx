import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { socket } from "../socket/socket";
import { useGame } from "../store/gameStore";
import GlassCard from "../components/GlassCard";
import GoldButton from "../components/GoldButton";
import ParticleBg from "../components/ParticleBg";
import SrkLogo from "../components/SrkLogo";
export default function Join() {
  const [sp] = useSearchParams();
  const [name, setName] = useState(""); const [city, setCity] = useState("");
  const [pin, setPin] = useState(sp.get("pin") ?? ""); const [err, setErr] = useState("");
  const nav = useNavigate();
  const join = (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    socket.emit("player:join", { pin: pin.trim(), name: name.trim(), city: city.trim() || undefined }, (r) => {
      if (r.ok) {
        localStorage.setItem("srk-player", JSON.stringify({ playerId: r.playerId, pin }));
        useGame.getState().set({ playerId: r.playerId, pin, score: 0, streak: 0 });
        nav("/play/lobby");
      } else setErr(r.error);
    });
  };
  return (
    <div className="relative min-h-dvh flex items-center justify-center p-6">
      <ParticleBg />
      <GlassCard className="z-10 w-full max-w-sm flex flex-col items-center">
        <SrkLogo size={90} />
        <h2 className="font-cinzel text-2xl gold-text text-center mb-6 mt-3">Join the Quiz</h2>
        <form onSubmit={join} className="space-y-3 w-full">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required
            className="w-full bg-ink-700 border border-gold-500/40 rounded-xl px-4 py-3 outline-none focus:border-gold-300" />
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="City (optional)"
            className="w-full bg-ink-700 border border-gold-500/40 rounded-xl px-4 py-3 outline-none focus:border-gold-300" />
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder="Game PIN" inputMode="numeric" required
            className="w-full bg-ink-700 border border-gold-500/40 rounded-xl px-4 py-3 outline-none focus:border-gold-300 tracking-widest text-center font-bebas text-2xl" />
          {err && <p className="text-ruby text-sm text-center">{err}</p>}
          <div className="text-center"><GoldButton type="submit">JOIN</GoldButton></div>
        </form>
      </GlassCard>
    </div>
  );
}
