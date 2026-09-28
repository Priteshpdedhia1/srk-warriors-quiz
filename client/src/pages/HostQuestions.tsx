import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, useHostAuth } from "../hooks/useHostAuth";
import GlassCard from "../components/GlassCard";
import ParticleBg from "../components/ParticleBg";

interface Q {
  id: string; text: string; options: string[]; correctIndex: number;
  explanation: string; difficulty: "EASY" | "MED" | "HARD"; category: string; order: number;
}

const base = () => import.meta.env.VITE_SERVER_URL as string;
const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

const BLANK = (): Omit<Q, "id" | "order"> => ({
  text: "", options: ["", "", "", ""], correctIndex: 0, explanation: "", difficulty: "MED", category: "General",
});

export default function HostQuestions() {
  const nav = useNavigate();
  const { require } = useHostAuth();
  const [list, setList] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [replaceAll, setReplaceAll] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const load = () => {
    setLoading(true);
    fetch(`${base()}/questions`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setList(d.questions); else setErr(d.error ?? "Failed to load"); })
      .catch(() => setErr("Could not reach the server"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { require(); load(); }, []);

  const addNew = async () => {
    const res = await fetch(`${base()}/questions`, { method: "POST", headers: authHeaders(), body: JSON.stringify(BLANK()) });
    const d = await res.json();
    if (d.ok) setList(l => [...l, d.question]);
    else alert(d.error ?? "Could not add");
  };

  const runImport = async () => {
    setImportMsg("");
    let questions: unknown;
    try { questions = JSON.parse(importText); } catch { setImportMsg("❌ Invalid JSON"); return; }
    if (!Array.isArray(questions)) { setImportMsg("❌ JSON must be an array of questions"); return; }
    if (replaceAll && !confirm(`Replace ALL questions with these ${questions.length}? This deletes the current bank.`)) return;
    setImportMsg("Importing…");
    try {
      const res = await fetch(`${base()}/questions/import`, { method: "POST", headers: authHeaders(),
        body: JSON.stringify({ questions, replace: replaceAll }) });
      const d = await res.json();
      if (d.ok) { setImportMsg(`✓ Imported ${d.added}. Bank now has ${d.total}.`); setImportText(""); load(); }
      else setImportMsg(`❌ ${d.error ?? "Import failed"}`);
    } catch { setImportMsg("❌ Could not reach the server"); }
  };

  return (
    <div className="relative min-h-dvh p-6 z-10">
      <ParticleBg />
      <div className="z-10 relative max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-3xl gold-text">Question Manager</h1>
          <button onClick={() => nav("/host")} className="text-gold-300 underline">← Dashboard</button>
        </div>
        <p className="text-cream-dim text-sm mb-3">{list.length} questions · each game/solo attempt draws a random shuffled subset · changes apply to the next game.</p>

        <div className="glass p-4 mb-5">
          <button onClick={() => setShowImport(s => !s)} className="font-semibold text-gold-300">
            {showImport ? "▾" : "▸"} Bulk import (JSON)
          </button>
          {showImport && (
            <div className="mt-3 space-y-2">
              <p className="text-cream-dim text-xs">Paste a JSON array. Each item: {"{ text, options:[4 strings], correctIndex:0-3, explanation?, difficulty?:\"EASY|MED|HARD\", category? }"}</p>
              <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={8}
                placeholder='[{"text":"...","options":["A","B","C","D"],"correctIndex":0,"category":"Movies"}]'
                className="w-full bg-ink-700 border border-gold-500/40 rounded-lg px-3 py-2 outline-none focus:border-gold-300 font-mono text-xs" />
              <label className="flex items-center gap-2 text-sm text-cream-dim">
                <input type="checkbox" checked={replaceAll} onChange={e => setReplaceAll(e.target.checked)} />
                Replace the entire bank (delete existing first)
              </label>
              <div className="flex items-center gap-3">
                <button onClick={runImport} disabled={!importText.trim()}
                  className="font-bebas tracking-wide text-ink-900 px-5 py-2 rounded-full bg-gradient-to-r from-gold-700 via-gold-100 to-gold-700 disabled:opacity-50">Import</button>
                {importMsg && <span className="text-sm">{importMsg}</span>}
              </div>
            </div>
          )}
        </div>

        {loading && <p className="text-cream-dim">Loading…</p>}
        {err && <p className="text-ruby">{err}</p>}
        <div className="space-y-4">
          {list.map((q, i) => (
            <QEditor key={q.id} q={q} n={i + 1}
              onSaved={(u) => setList(l => l.map(x => x.id === u.id ? u : x))}
              onDeleted={() => setList(l => l.filter(x => x.id !== q.id))} />
          ))}
        </div>
        <button onClick={addNew}
          className="mt-6 glass px-6 py-3 font-semibold hover:border-gold-300 transition w-full">＋ Add Question</button>
      </div>
    </div>
  );
}

function QEditor({ q, n, onSaved, onDeleted }:
  { q: Q; n: number; onSaved: (q: Q) => void; onDeleted: () => void }) {
  const [d, setD] = useState<Q>(q);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const set = (p: Partial<Q>) => { setD(x => ({ ...x, ...p })); setStatus(""); };
  const setOpt = (i: number, v: string) => set({ options: d.options.map((o, idx) => idx === i ? v : o) });

  const save = async () => {
    setStatus("saving");
    const res = await fetch(`${base()}/questions/${q.id}`, { method: "PUT", headers: authHeaders(),
      body: JSON.stringify({ text: d.text, options: d.options, correctIndex: d.correctIndex,
        explanation: d.explanation, difficulty: d.difficulty, category: d.category }) });
    const r = await res.json();
    if (r.ok) { onSaved(r.question); setStatus("saved"); } else setStatus("error");
  };
  const del = async () => {
    if (!confirm("Delete this question?")) return;
    const res = await fetch(`${base()}/questions/${q.id}`, { method: "DELETE", headers: authHeaders() });
    if ((await res.json()).ok) onDeleted();
  };

  const input = "w-full bg-ink-700 border border-gold-500/40 rounded-lg px-3 py-2 outline-none focus:border-gold-300";
  return (
    <GlassCard className="!p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bebas text-xl text-gold-300">Q{n}</span>
        <span className="text-xs text-cream-dim">tap the ● to mark the correct option</span>
      </div>
      <textarea value={d.text} onChange={e => set({ text: e.target.value })} placeholder="Question text"
        className={`${input} mb-3`} rows={2} />
      <div className="space-y-2 mb-3">
        {d.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <button onClick={() => set({ correctIndex: i })} title="Mark correct"
              className="text-2xl leading-none" style={{ color: d.correctIndex === i ? "#4ade80" : "#555" }}>
              {d.correctIndex === i ? "●" : "○"}
            </button>
            <input value={o} onChange={e => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} className={input} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <select value={d.difficulty} onChange={e => set({ difficulty: e.target.value as Q["difficulty"] })} className={input}>
          <option value="EASY">Easy</option><option value="MED">Medium</option><option value="HARD">Hard</option>
        </select>
        <input value={d.category} onChange={e => set({ category: e.target.value })} placeholder="Category" className={input} />
      </div>
      <input value={d.explanation} onChange={e => set({ explanation: e.target.value })} placeholder="Explanation (shown in answer key)" className={`${input} mb-3`} />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={status === "saving"}
          className="font-bebas tracking-wide text-ink-900 px-6 py-2 rounded-full bg-gradient-to-r from-gold-700 via-gold-100 to-gold-700 hover:brightness-110 disabled:opacity-50">
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        <button onClick={del} className="text-ruby hover:underline text-sm">Delete</button>
        {status === "saved" && <span className="text-green-400 text-sm">✓ Saved</span>}
        {status === "error" && <span className="text-ruby text-sm">✗ Check fields (need text + 4 options)</span>}
      </div>
    </GlassCard>
  );
}
