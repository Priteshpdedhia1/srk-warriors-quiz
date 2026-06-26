# SRK Warriors Live Quiz Platform — Design Spec

**Date:** 2026-06-26
**Status:** Approved (brainstorming)
**Scope:** v1 = reliable core for live event (days deadline). Phase 2 = deferred extras.

---

## 1. Purpose & Constraints

Real-time multiplayer quiz (Kahoot-style) for SRK Warriors annual event. Projected on
big screen, 100+ simultaneous players on their phones. Premium "King Khan" gold/luxury
aesthetic. Reused yearly.

- **Deadline:** days → ship reliable core, defer polish.
- **Run mode:** deployed, **100% free tier**. Frontend → Vercel (free). Backend → Render
  free web service (websocket-capable). Database → **Neon Postgres free tier**.
  SQLite dropped: free backend hosts give no persistent disk, so a SQLite file would reset.
  Neon = persistent, free, auto-wakes. Prisma `provider = "postgresql"` (schema otherwise
  identical). Cost = $0.
- **Auth:** no player login. Host password only (`srkwarriors`), verified server-side.
- **Questions:** 40 SRK trivia questions generated as seed data, editable later.

### v1 scope (IN)
Landing → host login → create game (PIN + QR) → players join → lobby → 40 Qs @ 30s
timer → answer capture (server-stamped response ms) → scoring + winner tiebreaks →
per-question reveal + distribution bar chart → live leaderboard (every 5 Qs) → host
analytics + full host controls → audio/sound FX → end screen (top 3 + confetti/fireworks)
→ reconnect + anti-double-submit.

### Phase 2 (DEFERRED)
Certificates PDF, Question Manager full CRUD/import-export (CSV/Excel/JSON), results
export, admin archive/restore, bonus systems (Fan Feud, Spin Wheel, badges, emoji
reactions, host chat), image/video/audio question types.

---

## 2. Architecture

```
srk-warriors-quiz/
├── client/                 # React + Vite + TS + Tailwind + Framer Motion + Zustand + React Query + React Router
│   └── src/
│       ├── pages/          # Landing, HostLogin, HostDashboard, HostGame, Join, Play, Leaderboard, Rules
│       ├── components/     # Timer, OptionCard, Leaderboard, ParticleBg, Podium, QRCode, Controls, etc.
│       ├── store/          # gameStore, audioStore, settingsStore (Zustand)
│       ├── socket/         # socket singleton + typed event helpers
│       ├── lib/            # api (React Query), theme tokens, shared types
│       └── hooks/
└── server/                 # Node + Express + Socket.IO + Prisma + Postgres (Neon)
    └── src/
        ├── index.ts        # http + socket bootstrap
        ├── socket/         # host.ts, player.ts, gameEngine.ts
        ├── routes/         # health, host(login), questions, results
        ├── services/       # scoring.ts, winner.ts, gameManager.ts
        └── prisma/         # seed (40 SRK Qs)
    └── prisma/schema.prisma
```

**Authoritative server state.** Live game state lives in a single in-memory `GameManager`
(source of truth driving the clock). SQLite is the durable record. DB writes (players,
answers) are async so they never block the live loop.

**Server-side timer.** Timer runs authoritatively on the server. Clients render the
countdown from an absolute `endsAt` timestamp but the server decides when time is up.
Kills client-clock cheating, keeps 100+ clients in sync, survives reconnect.

**Socket roles.** Host socket = controller (guarded by host token). Player sockets =
receivers. Server broadcasts to room `gameId`; host-only analytics go to room `host:<gameId>`.

---

## 3. Data Model (Prisma / Postgres — Neon free tier)

```prisma
Game     id, pin(6, unique among active), status(LOBBY|RUNNING|REVEAL|ENDED),
         currentIndex, settings(json), createdAt, endedAt
Player   id, gameId→, name, city?, socketId, connected(bool),
         score, streak, bestStreak, ip, joinedAt        @@unique([gameId, name])
Question id, text, options(json[4]), correctIndex, explanation,
         difficulty(EASY|MED|HARD), category, posterUrl?, imageUrl?, order
Answer   id, gameId→, playerId→, questionId→, selectedIndex,
         isCorrect, responseMs, createdAt               @@unique([playerId, questionId])
```

- `options` and `Game.settings` stored as `Json` columns (Postgres native jsonb; avoid
  over-normalizing 4 fixed options; YAGNI). Settings: `timerSec=30, totalQ=40,
  leaderboardEvery=5, autoAdvance, sound, music`.
- `@@unique([gameId, name])` → duplicate-name prevention enforced at DB level.
- `@@unique([playerId, questionId])` → double submission impossible at DB level.
- `responseMs` = server-stamped (question-shown → answer-received). Powers tiebreakers + analytics.
- **No Leaderboard table** — computed projection from Players + Answers (avoids stale data).

### Winner tiebreak chain — pure fn `resolveRanking(players, answers)`
1. score ↓
2. total responseMs ↑
3. fastest single correct answer ms ↑
4. best correct streak ↓
5. earliest completion time ↑
6. else → joint winners

---

## 4. Socket Event Contract (typed)

```ts
// Player → Server
"player:join"      { pin, name, city? }   → ack {ok, playerId, state} | {error}
"answer:submit"    { questionId, index }  → ack {ok, locked} | {error}
"player:reconnect" { playerId }           → ack {ok, state}

// Host → Server (guarded by host token)
"host:create" {settings} → {pin, gameId}
"host:start" | "host:next" | "host:prev" | "host:skip"
"host:pause" | "host:resume" | "host:reveal" | "host:restartQ"
"host:addTime"{s} | "host:subTime"{s}
"host:showBoard" | "host:hideBoard" | "host:end"

// Server → broadcast (room gameId)
"lobby:update"    { players[], count }
"question:show"   { index, total, question(NO correctIndex), endsAt }
"timer:tick"      { remainingMs }          // throttled ~250ms
"question:reveal" { correctIndex, explanation, distribution[4], pctCorrect }
"leaderboard:show"{ rows[] }   "leaderboard:hide"
"game:over"       { podium[3], fullRanking[] }
"player:scored"   { score, streak, isCorrect }   // unicast to that player
```

- `question:show` strips `correctIndex` before send — answer never reaches client until
  reveal (no network-tab cheat).
- `endsAt` = absolute server timestamp; client computes own countdown → lag/reconnect safe.
- `timer:tick` throttled server-side (~250ms); clients animate between ticks via rAF
  (raw per-frame emit floods at 100 players).

---

## 5. Screens & UX

### Player (phone, portrait)
join (name + city? + PIN) → lobby (waiting, live count, crowns) → question (huge text,
4 color/shape cards, circular timer) → tap locks cards → "Answer Locked ✓ / Waiting…" →
reveal (green correct, red your wrong pick, +1 pop, streak flame) → rank card every 5 Qs
→ game over (final card; confetti if top 3).

### Host (laptop → projector, landscape)
Landing (particles, gold, crowns; music/sound/fullscreen/theme toggles; buttons Host /
Join / Leaderboard / Rules) → host login (password server-verified) → dashboard (Create /
Resume / Question Manager[stub] / Settings) → create (big PIN + QR + join URL + live
lobby grid → Start) → live screen (Q#/40, timer ring, huge question, 4 tiles, answered
count + live accuracy, controls bar) → reveal (correct + explanation + distribution bar
chart + pctCorrect) → end (Champion/Runner-up/2nd, fireworks + confetti + applause, stat
cards: score, accuracy, total time, fastest, longest streak, avg).

### UX decisions
- Two layout systems: player = thumb-reach mobile; host = 16:9 projector, oversized type
  readable from back of hall. Shared theme tokens, separate components.
- Option cards Kahoot-style color+shape (red △ / blue ◆ / gold ● / green ■) → answer by
  position, glanceable on small screens.
- Host password via `POST /host/login` → signed token; never in JS bundle.
- Landing toggles persist in localStorage via `settingsStore`.

---

## 6. Brand Tokens (from existing posters)

- **Gold:** `#fbe8a6 #f0c75e #c8922a #f6d57a #d4a434 #b8860b`
- **Dark bg:** `#0d0a04 #14100a #0a0703`
- **Cream text:** `#faf6ea #f3e3b3 #e8d9ad`
- **Red accent:** `#a31010 #7c0b0b`
- **Fonts:** Cinzel (headlines), Bebas Neue (display/numbers), Great Vibes (script), Montserrat (body)
- Motifs: floating bokeh + gold diamonds, glassmorphism cards, gold-glow shadows, crowns.

---

## 7. Anti-Cheat & Reliability

- One answer per player per question (DB unique + in-memory guard).
- `correctIndex` withheld from client until reveal.
- Server-authoritative timer + absolute `endsAt`.
- Auto-reconnect: client stores `playerId` in localStorage → `player:reconnect` restores
  current question, score, remaining time.
- Disable browser back on player route (history guard).
- Every answer auto-saved on receipt (async DB write).

---

## 8. Performance

- In-memory game loop; async DB writes off the hot path.
- Throttled `timer:tick`; rAF interpolation on client.
- Code splitting per route, lazy-load heavy screens (end/fireworks).
- Single Socket.IO room per game; host-only events isolated to host room.
- Target: 100+ concurrent players on one game.

---

## 9. Deployment — 100% free tier ($0)

- **client** → **Vercel** (free). Env: `VITE_SERVER_URL`.
- **server** → **Render** free web service (Node, websocket-capable). Env: `HOST_PASSWORD`,
  `JWT_SECRET`, `DATABASE_URL` (Neon connection string), `CORS_ORIGIN`, `PORT`.
- **database** → **Neon** Postgres free tier. `DATABASE_URL` = Neon pooled connection
  string. Persistent, auto-wakes (<1s) from suspend.
- **Local dev:** can still use a local SQLite by swapping Prisma `provider`/`DATABASE_URL`,
  OR point at the same Neon dev branch. README documents both.

### Free-tier limitation (accepted)
Render free web service **sleeps after ~15min idle** (no persistent disk either — hence
Postgres not SQLite). Mitigation: free keep-alive pinger (cron-job.org / UptimeRobot)
hitting `GET /health` every ~10min to keep the backend warm before/around the event. Once
players are connected the socket traffic keeps it awake. Cold start (~50s) only happens
if fully idle — warm it up before going live.

- README covers local dev + Vercel + Render + Neon + keep-alive setup.

---

## 10. Out of Scope for this spec (explicit)
Certificates, full Question Manager, CSV/Excel import-export, admin archive/restore, bonus
game modes, multimedia question types. Each gets its own spec in Phase 2.
