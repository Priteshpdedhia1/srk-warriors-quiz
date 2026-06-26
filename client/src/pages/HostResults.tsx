import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, useHostAuth } from "../hooks/useHostAuth";
import GlassCard from "../components/GlassCard";
import ParticleBg from "../components/ParticleBg";
import DownloadResults from "../components/DownloadResults";

interface GameRow {
  id: string; pin: string; status: string;
  createdAt: string; endedAt: string | null; players: number; answers: number;
}

export default function HostResults() {
  const nav = useNavigate();
  const { require } = useHostAuth();
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    require();
    const base = import.meta.env.VITE_SERVER_URL as string;
    fetch(`${base}/results/games?token=${encodeURIComponent(getToken())}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setGames(d.games); else setErr(d.error ?? "Failed to load"); })
      .catch(() => setErr("Could not reach the server"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative min-h-dvh p-6 z-10">
      <ParticleBg />
      <div className="z-10 relative max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-3xl gold-text">Past Games</h1>
          <button onClick={() => nav("/host")} className="text-gold-300 underline">← Dashboard</button>
        </div>
        {loading && <p className="text-cream-dim">Loading…</p>}
        {err && <p className="text-ruby">{err}</p>}
        {!loading && !err && games.length === 0 && <p className="text-cream-dim">No games yet.</p>}
        <div className="space-y-3">
          {games.map(g => (
            <GlassCard key={g.id} className="!p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bebas text-2xl">PIN {g.pin} <span className="text-cream-dim text-base">· {g.status}</span></p>
                  <p className="text-cream-dim text-sm">
                    {new Date(g.createdAt).toLocaleString()} · {g.players} players · {g.answers} answers
                  </p>
                </div>
                <div className="flex flex-wrap gap-2"><DownloadResults gameId={g.id} /></div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}
