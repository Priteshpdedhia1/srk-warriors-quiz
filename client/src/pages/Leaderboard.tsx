import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LeaderboardRow } from "../lib/types";
import Leaderboard from "../components/Leaderboard";
import ParticleBg from "../components/ParticleBg";
import SrkLogo from "../components/SrkLogo";

export default function LeaderboardPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_SERVER_URL}/solo/leaderboard`)
      .then(r => r.json())
      .then(d => { if (d.ok) setRows(d.rows); else setErr(d.error ?? "Failed to load"); })
      .catch(() => setErr("Could not reach the server"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative min-h-dvh p-6 z-10">
      <ParticleBg />
      <div className="z-10 relative max-w-2xl mx-auto">
        <div className="flex flex-col items-center mb-6">
          <SrkLogo size={90} />
          <h1 className="font-cinzel text-4xl gold-text mt-3">Leaderboard</h1>
          <p className="text-cream-dim text-sm">All-time solo champions</p>
        </div>
        {loading && <p className="text-cream-dim text-center">Loading…</p>}
        {err && <p className="text-ruby text-center">{err}</p>}
        {!loading && !err && rows.length === 0 && <p className="text-cream-dim text-center">No scores yet — be the first!</p>}
        {rows.length > 0 && <Leaderboard rows={rows} max={100} />}
        <div className="text-center mt-8 flex gap-3 justify-center">
          <button onClick={() => nav("/solo")} className="font-bebas tracking-wide text-ink-900 px-6 py-2 rounded-full bg-gradient-to-r from-gold-700 via-gold-100 to-gold-700">PLAY NOW</button>
          <button onClick={() => nav("/")} className="glass px-6 py-2 font-semibold">Home</button>
        </div>
      </div>
    </div>
  );
}
