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
  const [term, setTerm] = useState("");
  const me = (() => { try { return localStorage.getItem("srk-solo-played") || ""; } catch { return ""; } })();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_SERVER_URL}/solo/leaderboard?limit=5000`)
      .then(r => r.json())
      .then(d => { if (d.ok) setRows(d.rows); else setErr(d.error ?? "Failed to load"); })
      .catch(() => setErr("Could not reach the server"))
      .finally(() => setLoading(false));
  }, []);

  const shown = term.trim()
    ? rows.filter(r => r.name.toLowerCase().includes(term.trim().toLowerCase()))
    : rows;

  return (
    <div className="relative min-h-dvh p-6 z-10">
      <ParticleBg />
      <div className="z-10 relative max-w-2xl mx-auto">
        <div className="flex flex-col items-center mb-6">
          <SrkLogo size={90} />
          <h1 className="font-cinzel text-4xl gold-text mt-3">Leaderboard</h1>
          <p className="text-cream-dim text-sm">All-time solo champions · {rows.length} player{rows.length === 1 ? "" : "s"}</p>
        </div>
        {loading && <p className="text-cream-dim text-center">Loading…</p>}
        {err && <p className="text-ruby text-center">{err}</p>}
        {!loading && !err && rows.length === 0 && <p className="text-cream-dim text-center">No scores yet — be the first!</p>}
        {rows.length > 0 && (
          <>
            <input value={term} onChange={e => setTerm(e.target.value)} type="search"
              placeholder="Search your name…" aria-label="Search leaderboard"
              className="w-full bg-ink-700 border border-gold-500/40 rounded-xl px-4 py-2.5 mb-3 outline-none focus:border-gold-300" />
            {shown.length === 0 && <p className="text-cream-dim text-center py-4">No player matches “{term}”.</p>}
            <Leaderboard rows={shown} max={shown.length} highlight={me} />
          </>
        )}
        <div className="text-center mt-8 flex gap-3 justify-center">
          <button onClick={() => nav("/solo")} className="font-bebas tracking-wide text-ink-900 px-6 py-2 rounded-full bg-gradient-to-r from-gold-700 via-gold-100 to-gold-700">PLAY NOW</button>
          <button onClick={() => nav("/")} className="glass px-6 py-2 font-semibold">Home</button>
        </div>
      </div>
    </div>
  );
}
