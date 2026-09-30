import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, useHostAuth } from "../hooks/useHostAuth";
import ParticleBg from "../components/ParticleBg";
import { ms2s, pct } from "../lib/format";
import type { LeaderboardRow } from "../lib/types";

const base = () => import.meta.env.VITE_SERVER_URL as string;

export default function HostLeaderboard() {
  const nav = useNavigate();
  const { require } = useHostAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = () => {
    setLoading(true);
    fetch(`${base()}/solo/leaderboard?limit=200`)
      .then(r => r.json())
      .then(d => { if (d.ok) setRows(d.rows); else setErr(d.error ?? "Failed to load"); })
      .catch(() => setErr("Could not reach the server"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { require(); load(); }, []);

  const del = async (name: string) => {
    if (!confirm(`Remove "${name}" from the leaderboard?\nThis also frees the name so they could play again.`)) return;
    const res = await fetch(`${base()}/solo/leaderboard/${encodeURIComponent(name)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
    });
    const d = await res.json().catch(() => ({}));
    if (d.ok) setRows(rs => rs.filter(r => r.name !== name));
    else alert(d.error ?? "Delete failed");
  };

  return (
    <div className="relative min-h-dvh p-6 z-10">
      <ParticleBg />
      <div className="z-10 relative max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-3xl gold-text">Manage Leaderboard</h1>
          <button onClick={() => nav("/host")} className="text-gold-300 underline">← Dashboard</button>
        </div>
        <p className="text-cream-dim text-sm mb-4">{rows.length} solo player{rows.length === 1 ? "" : "s"} · remove test rows or bad names. Ranked by score, ties broken by fastest total time.</p>

        {loading && <p className="text-cream-dim">Loading…</p>}
        {err && <p className="text-ruby">{err}</p>}
        {!loading && !err && rows.length === 0 && <p className="text-cream-dim">No entries yet.</p>}

        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.playerId} className="glass flex items-center gap-3 px-4 py-3">
              <span className="font-bebas text-2xl w-9 shrink-0 text-gold-300">#{r.rank}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{r.name}</div>
                <div className="text-cream-dim text-xs mt-0.5">⏱ {ms2s(r.totalMs)} · {pct(r.accuracy)} correct · {r.score} pts</div>
              </div>
              <button onClick={() => del(r.name)}
                className="shrink-0 text-ruby border border-ruby/40 rounded-lg px-3 py-1.5 text-sm hover:bg-ruby/10 transition">
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
