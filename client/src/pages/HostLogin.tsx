import { useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import GoldButton from "../components/GoldButton";
import ParticleBg from "../components/ParticleBg";
export default function HostLogin() {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const nav = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/host/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const data = await res.json();
    if (data.ok) { localStorage.setItem("srk-host-token", data.token); nav("/host"); }
    else setErr(data.error ?? "Login failed");
  };
  return (
    <div className="relative min-h-dvh flex items-center justify-center p-6">
      <ParticleBg />
      <GlassCard className="z-10 w-full max-w-sm">
        <h2 className="font-cinzel text-3xl gold-text mb-6 text-center">Host Login</h2>
        <form onSubmit={submit} className="space-y-4">
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Host password"
            className="w-full bg-ink-700 border border-gold-500/40 rounded-xl px-4 py-3 outline-none focus:border-gold-300" />
          {err && <p className="text-ruby text-sm">{err}</p>}
          <div className="text-center"><GoldButton type="submit">ENTER</GoldButton></div>
        </form>
      </GlassCard>
    </div>
  );
}
