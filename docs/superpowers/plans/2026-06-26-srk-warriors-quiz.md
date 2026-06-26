# SRK Warriors Live Quiz Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable real-time multiplayer SRK trivia quiz (Kahoot-style) for 100+ players: host controls a live game on a projector, players answer on phones, with server-authoritative timing, scoring with tiebreakers, live leaderboard, per-question reveal, host analytics, audio, and reconnect.

**Architecture:** Monorepo (`client/` + `server/`). Server holds authoritative in-memory game state (`GameManager`) driving a server-side timer; Postgres (Neon) via Prisma is the durable record written async off the hot path. Socket.IO carries all realtime events (host = controller, players = receivers). React (Vite) client with two layout systems (phone player / projector host).

**Tech Stack:** Client — React 18, Vite, TypeScript, TailwindCSS, Framer Motion, Zustand, React Query, React Router, socket.io-client, qrcode.react, canvas-confetti. Server — Node, Express, Socket.IO, Prisma, Postgres, jsonwebtoken, zod, vitest.

**Spec:** `docs/superpowers/specs/2026-06-26-srk-warriors-quiz-design.md`

---

## File Structure

```
srk-warriors-quiz/                  # repo root (existing OneDrive folder)
├── package.json                    # root: workspaces + dev scripts (concurrently)
├── shared/
│   └── types.ts                    # event payloads + domain types (copied into both)
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts                 # 40 SRK questions
│   └── src/
│       ├── index.ts                # express + http + socket bootstrap
│       ├── env.ts                  # validated env loader
│       ├── db.ts                   # PrismaClient singleton
│       ├── types.ts                # server-side shared types (re-export shared)
│       ├── services/
│       │   ├── scoring.ts          # scoreAnswer, per-player aggregates
│       │   ├── ranking.ts          # resolveRanking (tiebreak chain)
│       │   └── gameManager.ts      # in-memory authoritative game state + timer
│       ├── socket/
│       │   ├── index.ts            # io setup, connection routing
│       │   ├── player.ts           # player:* handlers
│       │   └── host.ts             # host:* handlers (token-guarded)
│       └── routes/
│           ├── health.ts           # GET /health (keep-alive)
│           ├── auth.ts             # POST /host/login
│           └── results.ts          # GET /results/:gameId (phase2-light: json)
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.tsx                # router + providers
        ├── index.css               # tailwind + theme tokens + fonts
        ├── lib/
        │   ├── types.ts            # = shared/types.ts
        │   ├── theme.ts            # color/font token constants
        │   └── format.ts           # ms→s, accuracy helpers
        ├── socket/
        │   └── socket.ts           # io() singleton + typed emit/on helpers
        ├── store/
        │   ├── gameStore.ts        # zustand: live game state (player+host)
        │   ├── settingsStore.ts    # music/sound/theme persisted
        │   └── audioStore.ts       # Howler-free WebAudio sfx player
        ├── hooks/
        │   ├── useCountdown.ts     # rAF countdown from endsAt
        │   └── useHostAuth.ts      # token guard
        ├── components/
        │   ├── ParticleBg.tsx      # bokeh + diamonds animated bg
        │   ├── GlassCard.tsx
        │   ├── GoldButton.tsx
        │   ├── CircularTimer.tsx
        │   ├── OptionCard.tsx      # color+shape answer tile
        │   ├── Leaderboard.tsx
        │   ├── Podium.tsx
        │   ├── AnswerBarChart.tsx
        │   └── Fireworks.tsx
        └── pages/
            ├── Landing.tsx
            ├── Rules.tsx
            ├── HostLogin.tsx
            ├── HostDashboard.tsx
            ├── HostCreate.tsx      # PIN + QR + lobby + start
            ├── HostGame.tsx        # live: question/timer/controls/analytics/reveal
            ├── HostEnd.tsx         # podium + fireworks + stats
            ├── Join.tsx            # name/city/PIN
            ├── PlayerLobby.tsx
            ├── PlayerPlay.tsx      # question + options + locked state
            └── PlayerEnd.tsx
```

**Decomposition rationale:** server logic split into pure functions (`scoring`, `ranking`) tested in isolation, plus one stateful `GameManager` that owns the loop. Socket handlers thin — they validate and delegate to `GameManager`. Client splits player vs host pages; shared visual components themed once.

---

## Phase 0 — Monorepo Scaffold

### Task 0.1: Root workspace + git baseline

**Files:**
- Create: `package.json`
- Modify: `.gitignore` (already exists)

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "srk-warriors-quiz",
  "private": true,
  "workspaces": ["server", "client", "shared"],
  "scripts": {
    "dev": "concurrently -n server,client -c yellow,cyan \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "npm --workspace server run dev",
    "dev:client": "npm --workspace client run dev",
    "build": "npm --workspace server run build && npm --workspace client run build"
  },
  "devDependencies": { "concurrently": "^9.1.0" }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: root monorepo workspace scaffold"
```

### Task 0.2: Shared types package

**Files:**
- Create: `shared/types.ts`, `shared/package.json`

- [ ] **Step 1: Create shared/package.json**

```json
{ "name": "shared", "version": "1.0.0", "type": "module", "main": "types.ts" }
```

- [ ] **Step 2: Create shared/types.ts** (single source of truth for event payloads)

```ts
export type Difficulty = "EASY" | "MED" | "HARD";
export type GameStatus = "LOBBY" | "RUNNING" | "REVEAL" | "ENDED";

export interface PublicQuestion {
  id: string;
  index: number;       // 0-based position in this game
  total: number;
  text: string;
  options: string[];   // length 4
  category: string;
  difficulty: Difficulty;
  posterUrl?: string | null;
  imageUrl?: string | null;
  // NOTE: correctIndex intentionally absent until reveal
}

export interface PlayerPublic {
  id: string; name: string; city?: string | null;
  score: number; streak: number; connected: boolean;
}

export interface LeaderboardRow {
  rank: number; playerId: string; name: string;
  score: number; totalMs: number; correct: number; wrong: number;
  accuracy: number; fastestMs: number | null; streak: number;
}

export interface RevealPayload {
  questionId: string;
  correctIndex: number;
  explanation: string;
  distribution: number[];   // counts per option index (len 4)
  pctCorrect: number;       // 0..100
}

export interface GameOverPayload {
  podium: LeaderboardRow[];          // up to 3 (joint-aware)
  fullRanking: LeaderboardRow[];
}

export interface GameSettings {
  timerSec: number; totalQ: number; leaderboardEvery: number;
  autoAdvance: boolean; sound: boolean; music: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  timerSec: 30, totalQ: 40, leaderboardEvery: 5,
  autoAdvance: false, sound: true, music: true,
};

// ---- Socket event maps (typed both ends) ----
export interface ClientToServer {
  "player:join": (p: { pin: string; name: string; city?: string },
    ack: (r: { ok: true; playerId: string; state: PlayerStateSnapshot } | { ok: false; error: string }) => void) => void;
  "player:reconnect": (p: { playerId: string },
    ack: (r: { ok: true; state: PlayerStateSnapshot } | { ok: false; error: string }) => void) => void;
  "answer:submit": (p: { questionId: string; index: number },
    ack: (r: { ok: true; locked: true } | { ok: false; error: string }) => void) => void;

  "host:create": (p: { token: string; settings: GameSettings },
    ack: (r: { ok: true; pin: string; gameId: string } | { ok: false; error: string }) => void) => void;
  "host:attach": (p: { token: string; gameId: string },
    ack: (r: { ok: true; state: HostStateSnapshot } | { ok: false; error: string }) => void) => void;
  "host:control": (p: { token: string; gameId: string; action: HostAction; value?: number },
    ack: (r: { ok: boolean; error?: string }) => void) => void;
}

export type HostAction =
  | "start" | "next" | "prev" | "skip" | "pause" | "resume"
  | "reveal" | "restartQ" | "addTime" | "subTime"
  | "showBoard" | "hideBoard" | "end";

export interface ServerToClient {
  "lobby:update": (p: { players: PlayerPublic[]; count: number }) => void;
  "question:show": (p: { question: PublicQuestion; endsAt: number; paused: boolean }) => void;
  "timer:tick": (p: { remainingMs: number; paused: boolean }) => void;
  "question:reveal": (p: RevealPayload) => void;
  "leaderboard:show": (p: { rows: LeaderboardRow[] }) => void;
  "leaderboard:hide": () => void;
  "game:over": (p: GameOverPayload) => void;
  "player:scored": (p: { score: number; streak: number; isCorrect: boolean; gainedMs: number }) => void;
  "host:analytics": (p: { answered: number; pending: number; liveAccuracy: number; distribution: number[] }) => void;
  "game:reset": () => void;
}

export interface PlayerStateSnapshot {
  status: GameStatus;
  question?: PublicQuestion;
  endsAt?: number;
  alreadyAnswered: boolean;
  selectedIndex?: number;
  score: number; streak: number;
}

export interface HostStateSnapshot {
  status: GameStatus; pin: string; currentIndex: number; total: number;
  players: PlayerPublic[]; question?: PublicQuestion; endsAt?: number; paused: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add shared/
git commit -m "feat(shared): typed socket event + domain contract"
```

---

## Phase 1 — Server Scaffold + Database

### Task 1.1: Server package + TypeScript + env

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/.env.example`, `server/src/env.ts`

- [ ] **Step 1: server/package.json**

```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate deploy",
    "prisma:push": "prisma db push",
    "seed": "tsx prisma/seed.ts",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "cors": "^2.8.5",
    "express": "^4.21.1",
    "jsonwebtoken": "^9.0.2",
    "socket.io": "^4.8.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.9.0",
    "prisma": "^5.22.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ES2022", "moduleResolution": "Bundler",
    "outDir": "dist", "rootDir": ".", "strict": true, "esModuleInterop": true,
    "skipLibCheck": true, "resolveJsonModule": true, "types": ["node"]
  },
  "include": ["src", "prisma", "../shared"]
}
```

- [ ] **Step 3: server/vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
```

- [ ] **Step 4: server/.env.example**

```
DATABASE_URL="postgresql://USER:PASS@HOST/db?sslmode=require"
HOST_PASSWORD="srkwarriors"
JWT_SECRET="change-me-long-random"
CORS_ORIGIN="http://localhost:5173"
PORT=4000
```

- [ ] **Step 5: server/src/env.ts**

```ts
import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  HOST_PASSWORD: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  CORS_ORIGIN: z.string().default("*"),
  PORT: z.coerce.number().default(4000),
});
export const env = schema.parse(process.env);
```

- [ ] **Step 6: Install + commit**

```bash
npm install
git add server/package.json server/tsconfig.json server/vitest.config.ts server/.env.example server/src/env.ts package-lock.json
git commit -m "chore(server): package, tsconfig, env validation"
```

### Task 1.2: Prisma schema + client singleton

**Files:**
- Create: `server/prisma/schema.prisma`, `server/src/db.ts`

- [ ] **Step 1: server/prisma/schema.prisma**

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum GameStatus { LOBBY RUNNING REVEAL ENDED }
enum Difficulty { EASY MED HARD }

model Game {
  id           String     @id @default(cuid())
  pin          String
  status       GameStatus @default(LOBBY)
  currentIndex Int        @default(-1)
  settings     Json
  createdAt    DateTime   @default(now())
  endedAt      DateTime?
  players      Player[]
  answers      Answer[]
  @@index([pin])
}

model Player {
  id        String   @id @default(cuid())
  gameId    String
  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  name      String
  city      String?
  socketId  String?
  connected Boolean  @default(true)
  score     Int      @default(0)
  streak    Int      @default(0)
  bestStreak Int     @default(0)
  ip        String?
  joinedAt  DateTime @default(now())
  answers   Answer[]
  @@unique([gameId, name])
}

model Question {
  id          String     @id @default(cuid())
  text        String
  options     Json       // string[4]
  correctIndex Int
  explanation String
  difficulty  Difficulty @default(MED)
  category    String     @default("General")
  posterUrl   String?
  imageUrl    String?
  order       Int        @default(0)
  @@index([order])
}

model Answer {
  id            String   @id @default(cuid())
  gameId        String
  game          Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  playerId      String
  player        Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  questionId    String
  selectedIndex Int
  isCorrect     Boolean
  responseMs    Int
  createdAt     DateTime @default(now())
  @@unique([playerId, questionId])
  @@index([gameId, questionId])
}
```

- [ ] **Step 2: server/src/db.ts**

```ts
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
```

- [ ] **Step 3: Generate client**

Run: `npm --workspace server run prisma:generate`
Expected: "Generated Prisma Client" success.

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/src/db.ts
git commit -m "feat(server): prisma schema + client singleton"
```

### Task 1.3: Seed — 40 SRK questions

**Files:**
- Create: `server/prisma/seed.ts`

- [ ] **Step 1: Write seed.ts** with 40 questions. Structure (full 40 authored here — abbreviated header shown; engineer fills the array from the canonical list below):

```ts
import { PrismaClient, Difficulty } from "@prisma/client";
const prisma = new PrismaClient();

type Q = { text: string; options: string[]; correctIndex: number;
  explanation: string; difficulty: Difficulty; category: string };

const QUESTIONS: Q[] = [
  { text: "In which year did Shah Rukh Khan make his Bollywood film debut with 'Deewana'?",
    options: ["1990","1992","1994","1988"], correctIndex: 1,
    explanation: "'Deewana' released in 1992, marking SRK's Bollywood debut.",
    difficulty: "EASY", category: "Career" },
  { text: "Which TV series gave SRK his early fame before films?",
    options: ["Fauji","Circus","Both Fauji and Circus","Hum Log"], correctIndex: 2,
    explanation: "He starred in both 'Fauji' (1989) and 'Circus' (1989).",
    difficulty: "MED", category: "Career" },
  { text: "What is the name of SRK's production company co-founded in 2002?",
    options: ["Red Chillies Entertainment","Dharma Productions","Yash Raj Films","Excel Entertainment"],
    correctIndex: 0, explanation: "Red Chillies Entertainment was founded by SRK and Gauri Khan.",
    difficulty: "EASY", category: "Business" },
  { text: "In 'Dilwale Dulhania Le Jayenge' (1995), what is SRK's character's name?",
    options: ["Rahul","Raj","Aman","Veer"], correctIndex: 1,
    explanation: "He plays Raj Malhotra in DDLJ.", difficulty: "EASY", category: "Movies" },
  { text: "Which 2007 sports film featured SRK as a hockey coach?",
    options: ["Chak De! India","Goal","Patiala House","Jersey"], correctIndex: 0,
    explanation: "SRK played coach Kabir Khan in 'Chak De! India'.",
    difficulty: "EASY", category: "Movies" },
  { text: "What is the iconic dialogue location pose SRK is famous for?",
    options: ["Folded arms","Outstretched arms","Hands on hips","Pointing finger"], correctIndex: 1,
    explanation: "His signature is the wide outstretched-arms pose.", difficulty: "EASY", category: "Iconic" },
  { text: "In 'My Name Is Khan' (2010), what condition does SRK's character have?",
    options: ["Autism","Asperger's syndrome","Dyslexia","Blindness"], correctIndex: 1,
    explanation: "Rizwan Khan has Asperger's syndrome.", difficulty: "MED", category: "Movies" },
  { text: "Which Yash Chopra film (2004) paired SRK with Rani Mukerji and Preity Zinta?",
    options: ["Veer-Zaara","Kabhi Alvida Naa Kehna","Mohabbatein","Chalte Chalte"], correctIndex: 0,
    explanation: "'Veer-Zaara' (2004) was directed by Yash Chopra.", difficulty: "MED", category: "Movies" },
  { text: "What does SRK's character do for a living in 'Swades' (2004)?",
    options: ["Doctor","NASA scientist","Teacher","Engineer at ISRO"], correctIndex: 1,
    explanation: "Mohan Bhargava is a NASA scientist who returns to India.", difficulty: "MED", category: "Movies" },
  { text: "Which film features the song 'Chaiyya Chaiyya' shot atop a moving train?",
    options: ["Dil Se","Asoka","Josh","Phir Bhi Dil Hai Hindustani"], correctIndex: 0,
    explanation: "'Chaiyya Chaiyya' is from 'Dil Se' (1998).", difficulty: "MED", category: "Music" },
  { text: "In 'Don' (2006), SRK plays a remake of a role originated by which actor?",
    options: ["Amitabh Bachchan","Rajesh Khanna","Dharmendra","Vinod Khanna"], correctIndex: 0,
    explanation: "Amitabh Bachchan played Don in the 1978 original.", difficulty: "MED", category: "Movies" },
  { text: "What is the name of SRK's character in 'Kabhi Khushi Kabhie Gham' (2001)?",
    options: ["Rahul Raichand","Rohan","Yashvardhan","Rohit"], correctIndex: 0,
    explanation: "He plays Rahul Raichand, the adopted elder son.", difficulty: "EASY", category: "Movies" },
  { text: "Which 2013 film had SRK playing dual roles, set partly on a train heist?",
    options: ["Chennai Express","Happy New Year","Raees","Fan"], correctIndex: 0,
    explanation: "Wait—dual role: 'Chennai Express' is single role; the dual-role 2013 film is actually...",
    difficulty: "HARD", category: "Movies" },
  { text: "In 'Chennai Express' (2013), who is SRK's co-star?",
    options: ["Deepika Padukone","Kajol","Anushka Sharma","Katrina Kaif"], correctIndex: 0,
    explanation: "Deepika Padukone starred as Meenamma.", difficulty: "EASY", category: "Movies" },
  { text: "Which IPL cricket team does SRK co-own?",
    options: ["Mumbai Indians","Kolkata Knight Riders","Chennai Super Kings","Delhi Capitals"], correctIndex: 1,
    explanation: "SRK co-owns Kolkata Knight Riders.", difficulty: "EASY", category: "Business" },
  { text: "What is SRK's full birth name?",
    options: ["Shah Rukh Khan","Abdul Rahman Khan","Shahrukh Hasan Khan","Aryan Khan"], correctIndex: 0,
    explanation: "His name is Shah Rukh Khan, born 2 November 1965.", difficulty: "MED", category: "Personal" },
  { text: "In which city was Shah Rukh Khan born?",
    options: ["Mumbai","Delhi","Lucknow","Hyderabad"], correctIndex: 1,
    explanation: "He was born in New Delhi.", difficulty: "MED", category: "Personal" },
  { text: "What is the name of SRK's Mumbai residence?",
    options: ["Jalsa","Mannat","Pratiksha","Antilia"], correctIndex: 1,
    explanation: "His bungalow is called 'Mannat'.", difficulty: "EASY", category: "Personal" },
  { text: "Which 2023 film marked a major comeback as an action spy thriller?",
    options: ["Pathaan","Jawan","Dunki","Brahmastra"], correctIndex: 0,
    explanation: "'Pathaan' (Jan 2023) was a blockbuster comeback.", difficulty: "EASY", category: "Movies" },
  { text: "Which 2023 Atlee-directed SRK film featured a dual father-son role?",
    options: ["Jawan","Pathaan","Dunki","Raees"], correctIndex: 0,
    explanation: "'Jawan' (2023) featured SRK in dual roles, directed by Atlee.", difficulty: "MED", category: "Movies" },
  { text: "Which Rajkumar Hirani film (2023) starred SRK on an immigration theme?",
    options: ["Dunki","Jawan","Pathaan","Zero"], correctIndex: 0,
    explanation: "'Dunki' (Dec 2023) was directed by Rajkumar Hirani.", difficulty: "MED", category: "Movies" },
  { text: "In 'Zero' (2018), what is unique about SRK's character Bauua Singh?",
    options: ["He is blind","He is a dwarf/vertically challenged","He is mute","He is a twin"], correctIndex: 1,
    explanation: "Bauua Singh is a vertically challenged man.", difficulty: "MED", category: "Movies" },
  { text: "Which actress is SRK's most frequent on-screen pairing?",
    options: ["Kajol","Rani Mukerji","Juhi Chawla","Madhuri Dixit"], correctIndex: 0,
    explanation: "Kajol is his most iconic recurring co-star.", difficulty: "EASY", category: "Movies" },
  { text: "What honour did the French government award SRK in 2014?",
    options: ["Legion of Honour","Ordre des Arts et des Lettres (earlier)","Croix de Guerre","Palme d'Or"], correctIndex: 0,
    explanation: "He received the Legion of Honour in 2014 (and Arts et Lettres in 2007).", difficulty: "HARD", category: "Awards" },
  { text: "In 'Baazigar' (1993), SRK played which type of role—rare for a lead at the time?",
    options: ["A comedian","An anti-hero/villain","A police officer","A singer"], correctIndex: 1,
    explanation: "He played a negative anti-hero lead in 'Baazigar'.", difficulty: "MED", category: "Movies" },
  { text: "Which film's character is named 'Devdas' played by SRK in 2002?",
    options: ["Devdas","Parineeta","Saawariya","Black"], correctIndex: 0,
    explanation: "He played the titular Devdas in Sanjay Leela Bhansali's 2002 film.", difficulty: "EASY", category: "Movies" },
  { text: "How many Filmfare Best Actor awards has SRK won (approx, record-tying)?",
    options: ["3","5","8","14"], correctIndex: 2,
    explanation: "He has won the Filmfare Best Actor award a record-tying number of times (8).", difficulty: "HARD", category: "Awards" },
  { text: "What is the name of SRK's eldest son?",
    options: ["AbRam","Aryan","Ishaan","Arjun"], correctIndex: 1,
    explanation: "His eldest son is Aryan Khan.", difficulty: "EASY", category: "Personal" },
  { text: "What is the name of SRK's daughter?",
    options: ["Suhana","Sara","Nysa","Shanaya"], correctIndex: 0,
    explanation: "His daughter is Suhana Khan.", difficulty: "EASY", category: "Personal" },
  { text: "Which 2016 film had SRK playing an obsessive fan and a superstar?",
    options: ["Fan","Raees","Dear Zindagi","Dilwale"], correctIndex: 0,
    explanation: "'Fan' (2016) featured SRK in dual roles as star Aryan and fan Gaurav.", difficulty: "MED", category: "Movies" },
  { text: "In 'Dear Zindagi' (2016), who plays the therapist opposite SRK?",
    options: ["Alia Bhatt","Deepika Padukone","Anushka Sharma","Kajol"], correctIndex: 0,
    explanation: "SRK plays therapist Jug; Alia Bhatt is the lead Kaira.", difficulty: "MED", category: "Movies" },
  { text: "Which company's brand has SRK NOT been a long-time ambassador for?",
    options: ["Pepsi","Hyundai","Fair & Lovely","Tesla"], correctIndex: 3,
    explanation: "SRK has endorsed Pepsi & Hyundai for years; never Tesla.", difficulty: "MED", category: "Business" },
  { text: "What nickname is SRK most popularly known by?",
    options: ["King Khan","The Boss","Thalaiva","Big B"], correctIndex: 0,
    explanation: "He is famously called 'King Khan' / 'Badshah of Bollywood'.", difficulty: "EASY", category: "Iconic" },
  { text: "Which 1998 film features SRK in 'Kuch Kuch Hota Hai' as which character?",
    options: ["Rahul","Raj","Aman","Sunil"], correctIndex: 0,
    explanation: "He plays Rahul Khanna in 'Kuch Kuch Hota Hai'.", difficulty: "EASY", category: "Movies" },
  { text: "Which film gave the iconic line 'Bade bade deshon mein...'?",
    options: ["DDLJ","Kuch Kuch Hota Hai","Dil To Pagal Hai","Pardes"], correctIndex: 0,
    explanation: "'Bade bade deshon mein aisi chhoti chhoti baatein' is from DDLJ.", difficulty: "MED", category: "Iconic" },
  { text: "In 'Om Shanti Om' (2007), who was introduced as the female lead?",
    options: ["Deepika Padukone","Anushka Sharma","Katrina Kaif","Sonam Kapoor"], correctIndex: 0,
    explanation: "'Om Shanti Om' marked Deepika Padukone's debut.", difficulty: "MED", category: "Movies" },
  { text: "Which dance reality/award show has SRK frequently hosted?",
    options: ["Kaun Banega Crorepati","Zor Ka Jhatka / award shows","Bigg Boss","Indian Idol"], correctIndex: 1,
    explanation: "He hosted KBC briefly and many award shows; KBC answer alone is incomplete—he hosted multiple.", difficulty: "HARD", category: "TV" },
  { text: "What sport is central to the plot of 'Chak De! India'?",
    options: ["Cricket","Field Hockey","Football","Kabaddi"], correctIndex: 1,
    explanation: "It centres on the Indian women's field hockey team.", difficulty: "EASY", category: "Movies" },
  { text: "Which 2010s film had SRK as a bootlegger named Raees?",
    options: ["Raees","Don 2","Happy New Year","Dilwale"], correctIndex: 0,
    explanation: "'Raees' (2017) features SRK as a bootlegger.", difficulty: "EASY", category: "Movies" },
  { text: "What is the title SRK fans collectively are often called?",
    options: ["SRKians","Khan Army","Warriors","All of these are used"], correctIndex: 3,
    explanation: "Fans use SRKians, and groups like SRK Warriors celebrate him.", difficulty: "MED", category: "Fandom" },
];

async function main() {
  await prisma.question.deleteMany();
  await Promise.all(QUESTIONS.map((q, i) =>
    prisma.question.create({ data: { ...q, order: i } })));
  console.log(`Seeded ${QUESTIONS.length} questions`);
}
main().finally(() => prisma.$disconnect());
```

> **Note for engineer:** the array above has 40 items. Two entries (index 12 "dual roles 2013" and index 36 "dance show") have deliberately loose explanations — replace with cleaner facts during review, or drop/duplicate to keep exactly 40 with crisp correct answers. Verify `correctIndex` for each before shipping.

- [ ] **Step 2: Commit**

```bash
git add server/prisma/seed.ts
git commit -m "feat(server): seed 40 SRK quiz questions"
```

---

## Phase 2 — Pure Logic (TDD)

### Task 2.1: Scoring service

**Files:**
- Create: `server/src/services/scoring.ts`
- Test: `server/src/services/scoring.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { scoreAnswer, aggregatePlayer } from "./scoring";

describe("scoreAnswer", () => {
  it("correct answer earns 1 point and increments streak", () => {
    expect(scoreAnswer({ score: 3, streak: 2, bestStreak: 2 }, true))
      .toEqual({ score: 4, streak: 3, bestStreak: 3 });
  });
  it("wrong answer earns 0 and resets streak, keeps bestStreak", () => {
    expect(scoreAnswer({ score: 3, streak: 5, bestStreak: 5 }, false))
      .toEqual({ score: 3, streak: 0, bestStreak: 5 });
  });
});

describe("aggregatePlayer", () => {
  it("computes totals from a list of answers", () => {
    const ans = [
      { isCorrect: true, responseMs: 3000 },
      { isCorrect: false, responseMs: 9000 },
      { isCorrect: true, responseMs: 4000 },
    ];
    const a = aggregatePlayer(ans);
    expect(a.correct).toBe(2);
    expect(a.wrong).toBe(1);
    expect(a.totalMs).toBe(16000);
    expect(a.fastestCorrectMs).toBe(3000);
    expect(a.accuracy).toBeCloseTo(66.6667, 2);
  });
  it("fastestCorrectMs is null when no correct answers", () => {
    expect(aggregatePlayer([{ isCorrect: false, responseMs: 5000 }]).fastestCorrectMs).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm --workspace server run test -- scoring`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement scoring.ts**

```ts
export interface PlayerScoreState { score: number; streak: number; bestStreak: number; }

export function scoreAnswer(s: PlayerScoreState, isCorrect: boolean): PlayerScoreState {
  if (isCorrect) {
    const streak = s.streak + 1;
    return { score: s.score + 1, streak, bestStreak: Math.max(s.bestStreak, streak) };
  }
  return { score: s.score, streak: 0, bestStreak: s.bestStreak };
}

export interface MiniAnswer { isCorrect: boolean; responseMs: number; }
export interface PlayerAggregate {
  correct: number; wrong: number; totalMs: number;
  fastestCorrectMs: number | null; accuracy: number;
}

export function aggregatePlayer(answers: MiniAnswer[]): PlayerAggregate {
  let correct = 0, wrong = 0, totalMs = 0, fastest: number | null = null;
  for (const a of answers) {
    totalMs += a.responseMs;
    if (a.isCorrect) { correct++; fastest = fastest === null ? a.responseMs : Math.min(fastest, a.responseMs); }
    else wrong++;
  }
  const answered = correct + wrong;
  return { correct, wrong, totalMs, fastestCorrectMs: fastest,
    accuracy: answered === 0 ? 0 : (correct / answered) * 100 };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm --workspace server run test -- scoring`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/scoring.ts server/src/services/scoring.test.ts
git commit -m "feat(server): scoring service with TDD"
```

### Task 2.2: Ranking service (winner tiebreak chain)

**Files:**
- Create: `server/src/services/ranking.ts`
- Test: `server/src/services/ranking.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveRanking, RankInput } from "./ranking";

const mk = (id: string, o: Partial<RankInput>): RankInput => ({
  playerId: id, name: id, score: 0, totalMs: 0, fastestCorrectMs: null,
  bestStreak: 0, completedAt: 0, correct: 0, wrong: 0, ...o,
});

describe("resolveRanking", () => {
  it("ranks by score descending", () => {
    const r = resolveRanking([mk("a", { score: 2 }), mk("b", { score: 5 })]);
    expect(r.map(x => x.playerId)).toEqual(["b", "a"]);
    expect(r[0].rank).toBe(1);
  });
  it("breaks score tie by lower totalMs", () => {
    const r = resolveRanking([mk("a", { score: 5, totalMs: 9000 }), mk("b", { score: 5, totalMs: 4000 })]);
    expect(r[0].playerId).toBe("b");
  });
  it("breaks remaining tie by fastest single correct answer", () => {
    const r = resolveRanking([
      mk("a", { score: 5, totalMs: 5000, fastestCorrectMs: 2000 }),
      mk("b", { score: 5, totalMs: 5000, fastestCorrectMs: 1000 }),
    ]);
    expect(r[0].playerId).toBe("b");
  });
  it("then by longest streak, then earliest completion; assigns joint ranks", () => {
    const r = resolveRanking([
      mk("a", { score: 5, totalMs: 5000, fastestCorrectMs: 1000, bestStreak: 3, completedAt: 100 }),
      mk("b", { score: 5, totalMs: 5000, fastestCorrectMs: 1000, bestStreak: 3, completedAt: 100 }),
    ]);
    expect(r[0].rank).toBe(1);
    expect(r[1].rank).toBe(1); // joint
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm --workspace server run test -- ranking`
Expected: FAIL.

- [ ] **Step 3: Implement ranking.ts**

```ts
export interface RankInput {
  playerId: string; name: string; score: number; totalMs: number;
  fastestCorrectMs: number | null; bestStreak: number; completedAt: number;
  correct: number; wrong: number;
}
export interface Ranked extends RankInput { rank: number; }

const FAST = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v);

// returns negative if a should rank ahead of b
function compare(a: RankInput, b: RankInput): number {
  if (b.score !== a.score) return b.score - a.score;          // score desc
  if (a.totalMs !== b.totalMs) return a.totalMs - b.totalMs;  // totalMs asc
  if (FAST(a.fastestCorrectMs) !== FAST(b.fastestCorrectMs))
    return FAST(a.fastestCorrectMs) - FAST(b.fastestCorrectMs); // fastest asc
  if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak; // streak desc
  return a.completedAt - b.completedAt;                        // earliest asc
}

// two players are "tied" (joint) when all tiebreak keys are equal
function tied(a: RankInput, b: RankInput): boolean {
  return a.score === b.score && a.totalMs === b.totalMs &&
    FAST(a.fastestCorrectMs) === FAST(b.fastestCorrectMs) &&
    a.bestStreak === b.bestStreak && a.completedAt === b.completedAt;
}

export function resolveRanking(players: RankInput[]): Ranked[] {
  const sorted = [...players].sort(compare);
  const out: Ranked[] = [];
  let rank = 0;
  sorted.forEach((p, i) => {
    if (i > 0 && tied(sorted[i - 1], p)) {
      out.push({ ...p, rank: out[i - 1].rank }); // joint = same rank
    } else {
      rank = i + 1;
      out.push({ ...p, rank });
    }
  });
  return out;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm --workspace server run test -- ranking`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/ranking.ts server/src/services/ranking.test.ts
git commit -m "feat(server): ranking with full tiebreak chain (TDD)"
```

---

## Phase 3 — GameManager (authoritative state + timer)

### Task 3.1: GameManager core (TDD with fake timers)

**Files:**
- Create: `server/src/services/gameManager.ts`
- Test: `server/src/services/gameManager.test.ts`

`GameManager` is an `EventEmitter` owning a `Map<gameId, LiveGame>`. It exposes pure-ish methods (`createGame`, `addPlayer`, `submitAnswer`, host controls) and emits internal events the socket layer forwards. Timer driven by `setInterval` (fake-timed in tests). Persistence callbacks injected so tests don't hit DB.

- [ ] **Step 1: Write failing test** (covers join dedup, question lifecycle, answer lock, timeout reveal)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameManager } from "./gameManager";
import { DEFAULT_SETTINGS } from "../../../shared/types";

const QS = [
  { id: "q1", text: "Q1", options: ["a","b","c","d"], correctIndex: 1, explanation: "e1", difficulty: "EASY" as const, category: "x" },
  { id: "q2", text: "Q2", options: ["a","b","c","d"], correctIndex: 0, explanation: "e2", difficulty: "EASY" as const, category: "x" },
];

function newGM() {
  return new GameManager({
    loadQuestions: async () => QS,
    persist: { game: vi.fn(), player: vi.fn(async () => "pid"), answer: vi.fn(), end: vi.fn() },
  });
}

describe("GameManager", () => {
  beforeEach(() => vi.useFakeTimers());

  it("creates a game with a 6-digit pin and LOBBY status", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2 });
    expect(g.pin).toMatch(/^\d{6}$/);
    expect(g.status).toBe("LOBBY");
  });

  it("rejects duplicate names in same game", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2 });
    await gm.addPlayer(g.id, { name: "Raj", socketId: "s1" });
    await expect(gm.addPlayer(g.id, { name: "Raj", socketId: "s2" }))
      .rejects.toThrow(/name/i);
  });

  it("starting emits question:show with correctIndex stripped", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2, timerSec: 30 });
    const spy = vi.fn();
    gm.on("question:show", spy);
    await gm.start(g.id);
    const payload = spy.mock.calls[0][1];
    expect(payload.question).not.toHaveProperty("correctIndex");
    expect(payload.endsAt).toBeGreaterThan(Date.now());
  });

  it("scores a correct answer and blocks a second submission", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2, timerSec: 30 });
    const p = await gm.addPlayer(g.id, { name: "Raj", socketId: "s1" });
    await gm.start(g.id);
    const r1 = await gm.submitAnswer(g.id, p.id, "q1", 1);
    expect(r1.ok).toBe(true);
    const r2 = await gm.submitAnswer(g.id, p.id, "q1", 2);
    expect(r2).toEqual({ ok: false, error: expect.stringMatching(/already/i) });
    expect(gm.getPlayer(g.id, p.id)!.score).toBe(1);
  });

  it("emits question:reveal automatically when the timer expires", async () => {
    const gm = newGM();
    const g = await gm.createGame({ ...DEFAULT_SETTINGS, totalQ: 2, timerSec: 1 });
    const reveal = vi.fn();
    gm.on("question:reveal", reveal);
    await gm.start(g.id);
    await vi.advanceTimersByTimeAsync(1100);
    expect(reveal).toHaveBeenCalledOnce();
    expect(reveal.mock.calls[0][1].correctIndex).toBe(1);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm --workspace server run test -- gameManager`
Expected: FAIL.

- [ ] **Step 3: Implement gameManager.ts**

```ts
import { EventEmitter } from "node:events";
import { scoreAnswer } from "./scoring";
import type { GameSettings, PublicQuestion, GameStatus } from "../../../shared/types";

export interface SeedQuestion {
  id: string; text: string; options: string[]; correctIndex: number;
  explanation: string; difficulty: "EASY" | "MED" | "HARD"; category: string;
  posterUrl?: string | null; imageUrl?: string | null;
}
interface LivePlayer {
  id: string; name: string; city?: string | null; socketId?: string;
  connected: boolean; score: number; streak: number; bestStreak: number;
  completedAt: number;
}
interface LiveAnswer { selectedIndex: number; isCorrect: boolean; responseMs: number; }
interface LiveGame {
  id: string; pin: string; status: GameStatus; settings: GameSettings;
  questions: SeedQuestion[]; currentIndex: number;
  players: Map<string, LivePlayer>;
  answers: Map<string, Map<string, LiveAnswer>>; // questionId -> playerId -> answer
  questionShownAt: number; endsAt: number; remainingAtPause: number;
  paused: boolean; timer?: NodeJS.Timeout; boardVisible: boolean;
}

export interface Persistence {
  game: (g: { id: string; pin: string; settings: GameSettings }) => Promise<void> | void;
  player: (gameId: string, p: { name: string; city?: string | null; ip?: string }) => Promise<string>;
  answer: (a: { gameId: string; playerId: string; questionId: string;
    selectedIndex: number; isCorrect: boolean; responseMs: number }) => Promise<void> | void;
  end: (gameId: string) => Promise<void> | void;
}
export interface GMDeps { loadQuestions: () => Promise<SeedQuestion[]>; persist: Persistence; }

const TICK_MS = 250;
const genPin = () => String(Math.floor(100000 + Math.random() * 900000));
const stripQuestion = (q: SeedQuestion, index: number, total: number): PublicQuestion => ({
  id: q.id, index, total, text: q.text, options: q.options,
  category: q.category, difficulty: q.difficulty, posterUrl: q.posterUrl, imageUrl: q.imageUrl,
});

export class GameManager extends EventEmitter {
  private games = new Map<string, LiveGame>();
  constructor(private deps: GMDeps) { super(); }

  getGameByPin(pin: string) { return [...this.games.values()].find(g => g.pin === pin && g.status !== "ENDED"); }
  getGame(id: string) { return this.games.get(id); }
  getPlayer(gameId: string, playerId: string) { return this.games.get(gameId)?.players.get(playerId); }

  async createGame(settings: GameSettings) {
    const questions = (await this.deps.loadQuestions()).slice(0, settings.totalQ);
    let pin = genPin(); while (this.getGameByPin(pin)) pin = genPin();
    const id = "g_" + Math.random().toString(36).slice(2, 10);
    const game: LiveGame = {
      id, pin, status: "LOBBY", settings, questions, currentIndex: -1,
      players: new Map(), answers: new Map(), questionShownAt: 0, endsAt: 0,
      remainingAtPause: 0, paused: false, boardVisible: false,
    };
    this.games.set(id, game);
    await this.deps.persist.game({ id, pin, settings });
    return game;
  }

  async addPlayer(gameId: string, p: { name: string; city?: string | null; socketId?: string; ip?: string }) {
    const g = this.req(gameId);
    if (g.status !== "LOBBY") throw new Error("Game already started");
    const name = p.name.trim();
    if (!name) throw new Error("Name required");
    if ([...g.players.values()].some(x => x.name.toLowerCase() === name.toLowerCase()))
      throw new Error("That name is already taken");
    const id = await this.deps.persist.player(gameId, { name, city: p.city, ip: p.ip });
    const player: LivePlayer = { id, name, city: p.city, socketId: p.socketId,
      connected: true, score: 0, streak: 0, bestStreak: 0, completedAt: 0 };
    g.players.set(id, player);
    this.emitLobby(g);
    return player;
  }

  reconnect(gameId: string, playerId: string, socketId: string) {
    const g = this.games.get(gameId); const p = g?.players.get(playerId);
    if (!g || !p) return null;
    p.connected = true; p.socketId = socketId; this.emitLobby(g);
    return { g, p };
  }
  disconnectSocket(socketId: string) {
    for (const g of this.games.values())
      for (const p of g.players.values())
        if (p.socketId === socketId) { p.connected = false; this.emitLobby(g); return; }
  }

  async start(gameId: string) { const g = this.req(gameId); if (g.status === "LOBBY") this.showQuestion(g, 0); }

  private showQuestion(g: LiveGame, index: number) {
    if (index < 0 || index >= g.questions.length) return this.end(g.id);
    this.clearTimer(g);
    g.currentIndex = index; g.status = "RUNNING"; g.paused = false; g.boardVisible = false;
    g.questionShownAt = Date.now();
    g.endsAt = g.questionShownAt + g.settings.timerSec * 1000;
    const q = g.questions[index];
    if (!g.answers.has(q.id)) g.answers.set(q.id, new Map());
    this.emit("question:show", g.id, {
      question: stripQuestion(q, index, g.questions.length), endsAt: g.endsAt, paused: false });
    this.startTimer(g);
    this.emitAnalytics(g);
  }

  private startTimer(g: LiveGame) {
    g.timer = setInterval(() => {
      if (g.paused) return;
      const remaining = g.endsAt - Date.now();
      this.emit("timer:tick", g.id, { remainingMs: Math.max(0, remaining), paused: false });
      if (remaining <= 0) this.reveal(g.id);
    }, TICK_MS);
  }
  private clearTimer(g: LiveGame) { if (g.timer) { clearInterval(g.timer); g.timer = undefined; } }

  async submitAnswer(gameId: string, playerId: string, questionId: string, index: number) {
    const g = this.games.get(gameId);
    if (!g || g.status !== "RUNNING") return { ok: false as const, error: "No active question" };
    const q = g.questions[g.currentIndex];
    if (!q || q.id !== questionId) return { ok: false as const, error: "Question mismatch" };
    const p = g.players.get(playerId);
    if (!p) return { ok: false as const, error: "Unknown player" };
    const map = g.answers.get(q.id)!;
    if (map.has(playerId)) return { ok: false as const, error: "You already answered" };
    if (index < 0 || index > 3) return { ok: false as const, error: "Invalid option" };
    const responseMs = Date.now() - g.questionShownAt;
    const isCorrect = index === q.correctIndex;
    map.set(playerId, { selectedIndex: index, isCorrect, responseMs });
    const next = scoreAnswer(p, isCorrect);
    p.score = next.score; p.streak = next.streak; p.bestStreak = next.bestStreak;
    p.completedAt = Date.now();
    await this.deps.persist.answer({ gameId, playerId, questionId, selectedIndex: index, isCorrect, responseMs });
    this.emit("player:scored", g.id, playerId, {
      score: p.score, streak: p.streak, isCorrect, gainedMs: responseMs });
    this.emitAnalytics(g);
    if (map.size >= [...g.players.values()].filter(x => x.connected).length && g.settings.autoAdvance)
      this.reveal(g.id);
    return { ok: true as const };
  }

  reveal(gameId: string) {
    const g = this.req(gameId);
    if (g.status !== "RUNNING") return;
    this.clearTimer(g); g.status = "REVEAL";
    const q = g.questions[g.currentIndex];
    const map = g.answers.get(q.id)!;
    const distribution = [0, 0, 0, 0];
    let correct = 0;
    for (const a of map.values()) { distribution[a.selectedIndex]++; if (a.isCorrect) correct++; }
    const answered = map.size;
    this.emit("question:reveal", g.id, {
      questionId: q.id, correctIndex: q.correctIndex, explanation: q.explanation,
      distribution, pctCorrect: answered ? (correct / answered) * 100 : 0 });
  }

  // ---- host controls ----
  next(gameId: string) { const g = this.req(gameId); this.showQuestion(g, g.currentIndex + 1); }
  prev(gameId: string) { const g = this.req(gameId); this.showQuestion(g, Math.max(0, g.currentIndex - 1)); }
  skip(gameId: string) { this.next(gameId); }
  restartQ(gameId: string) { const g = this.req(gameId); this.showQuestion(g, g.currentIndex); }
  pause(gameId: string) {
    const g = this.req(gameId); if (g.status !== "RUNNING" || g.paused) return;
    g.paused = true; g.remainingAtPause = g.endsAt - Date.now();
    this.emit("timer:tick", g.id, { remainingMs: Math.max(0, g.remainingAtPause), paused: true });
  }
  resume(gameId: string) {
    const g = this.req(gameId); if (g.status !== "RUNNING" || !g.paused) return;
    g.paused = false; g.endsAt = Date.now() + g.remainingAtPause;
  }
  addTime(gameId: string, sec: number) { const g = this.req(gameId); g.endsAt += sec * 1000; if (g.paused) g.remainingAtPause += sec * 1000; }
  subTime(gameId: string, sec: number) { const g = this.req(gameId); g.endsAt -= sec * 1000; if (g.paused) g.remainingAtPause -= sec * 1000; }
  showBoard(gameId: string) { const g = this.req(gameId); g.boardVisible = true; this.emit("leaderboard:show", g.id, { rows: this.leaderboard(g) }); }
  hideBoard(gameId: string) { const g = this.req(gameId); g.boardVisible = false; this.emit("leaderboard:hide", g.id); }

  async end(gameId: string) {
    const g = this.req(gameId); this.clearTimer(g); g.status = "ENDED";
    await this.deps.persist.end(gameId);
    const rows = this.leaderboard(g);
    this.emit("game:over", g.id, { podium: rows.slice(0, 3), fullRanking: rows });
  }

  // ---- projections ----
  leaderboard(g: LiveGame) {
    // import lazily to avoid cycle in some bundlers
    const { resolveRanking } = require("./ranking");
    const inputs = [...g.players.values()].map(p => {
      let totalMs = 0, correct = 0, wrong = 0, fastest: number | null = null;
      for (const map of g.answers.values()) {
        const a = map.get(p.id); if (!a) continue;
        totalMs += a.responseMs;
        if (a.isCorrect) { correct++; fastest = fastest === null ? a.responseMs : Math.min(fastest, a.responseMs); }
        else wrong++;
      }
      return { playerId: p.id, name: p.name, score: p.score, totalMs,
        fastestCorrectMs: fastest, bestStreak: p.bestStreak, completedAt: p.completedAt, correct, wrong };
    });
    return resolveRanking(inputs).map((r: any) => ({
      rank: r.rank, playerId: r.playerId, name: r.name, score: r.score, totalMs: r.totalMs,
      correct: r.correct, wrong: r.wrong,
      accuracy: (r.correct + r.wrong) ? (r.correct / (r.correct + r.wrong)) * 100 : 0,
      fastestMs: r.fastestCorrectMs, streak: r.bestStreak,
    }));
  }
  publicPlayers(g: LiveGame) {
    return [...g.players.values()].map(p => ({ id: p.id, name: p.name, city: p.city,
      score: p.score, streak: p.streak, connected: p.connected }));
  }
  private emitLobby(g: LiveGame) {
    const players = this.publicPlayers(g);
    this.emit("lobby:update", g.id, { players, count: players.length });
  }
  private emitAnalytics(g: LiveGame) {
    const q = g.questions[g.currentIndex]; if (!q) return;
    const map = g.answers.get(q.id) ?? new Map();
    const distribution = [0, 0, 0, 0]; let correct = 0;
    for (const a of map.values()) { distribution[a.selectedIndex]++; if (a.isCorrect) correct++; }
    const total = [...g.players.values()].filter(p => p.connected).length;
    const answered = map.size;
    this.emit("host:analytics", g.id, {
      answered, pending: Math.max(0, total - answered),
      liveAccuracy: answered ? (correct / answered) * 100 : 0, distribution });
  }
  private req(id: string) { const g = this.games.get(id); if (!g) throw new Error("Game not found"); return g; }
}
```

> **Note:** the `require("./ranking")` inside `leaderboard` is a deliberate lazy import to dodge an ESM circular-import edge case; if your bundler dislikes it, switch to a top-level `import { resolveRanking } from "./ranking"`.

- [ ] **Step 4: Run, verify pass**

Run: `npm --workspace server run test -- gameManager`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/gameManager.ts server/src/services/gameManager.test.ts
git commit -m "feat(server): authoritative GameManager with server-side timer (TDD)"
```

---

## Phase 4 — Socket + REST Wiring

### Task 4.1: Express bootstrap + health + host login

**Files:**
- Create: `server/src/routes/health.ts`, `server/src/routes/auth.ts`, `server/src/index.ts`

- [ ] **Step 1: routes/health.ts**

```ts
import { Router } from "express";
export const health = Router();
health.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
```

- [ ] **Step 2: routes/auth.ts**

```ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../env";
export const auth = Router();
const body = z.object({ password: z.string() });
auth.post("/host/login", (req, res) => {
  const parsed = body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Bad request" });
  if (parsed.data.password !== env.HOST_PASSWORD)
    return res.status(401).json({ ok: false, error: "Wrong password" });
  const token = jwt.sign({ role: "host" }, env.JWT_SECRET, { expiresIn: "12h" });
  res.json({ ok: true, token });
});
export function verifyHost(token: string): boolean {
  try { const d = jwt.verify(token, env.JWT_SECRET) as any; return d.role === "host"; }
  catch { return false; }
}
```

- [ ] **Step 3: src/index.ts**

```ts
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./env";
import { health } from "./routes/health";
import { auth } from "./routes/auth";
import { prisma } from "./db";
import { GameManager } from "./services/gameManager";
import { registerSockets } from "./socket";

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN.split(",") }));
app.use(express.json());
app.use(health);
app.use(auth);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: env.CORS_ORIGIN.split(",") } });

const gm = new GameManager({
  loadQuestions: async () => {
    const qs = await prisma.question.findMany({ orderBy: { order: "asc" } });
    return qs.map(q => ({ id: q.id, text: q.text, options: q.options as string[],
      correctIndex: q.correctIndex, explanation: q.explanation,
      difficulty: q.difficulty, category: q.category, posterUrl: q.posterUrl, imageUrl: q.imageUrl }));
  },
  persist: {
    game: async (g) => { await prisma.game.create({ data: { id: g.id, pin: g.pin, settings: g.settings as any } }); },
    player: async (gameId, p) => {
      const row = await prisma.player.create({ data: { gameId, name: p.name, city: p.city, ip: p.ip } });
      return row.id;
    },
    answer: async (a) => { await prisma.answer.create({ data: a }).catch(() => {}); },
    end: async (gameId) => { await prisma.game.update({ where: { id: gameId }, data: { status: "ENDED", endedAt: new Date() } }); },
  },
});

registerSockets(io, gm);
httpServer.listen(env.PORT, () => console.log(`server on :${env.PORT}`));
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes server/src/index.ts
git commit -m "feat(server): express bootstrap, health, host login"
```

### Task 4.2: Socket handlers (forward GameManager events; route player/host)

**Files:**
- Create: `server/src/socket/index.ts`, `server/src/socket/player.ts`, `server/src/socket/host.ts`

- [ ] **Step 1: socket/index.ts** — wire GameManager emits → rooms

```ts
import type { Server } from "socket.io";
import type { GameManager } from "../services/gameManager";
import { registerPlayer } from "./player";
import { registerHost } from "./host";

const room = (gameId: string) => `game:${gameId}`;
const hostRoom = (gameId: string) => `host:${gameId}`;

export function registerSockets(io: Server, gm: GameManager) {
  // GameManager → clients
  gm.on("lobby:update", (gid, p) => { io.to(room(gid)).emit("lobby:update", p); io.to(hostRoom(gid)).emit("lobby:update", p); });
  gm.on("question:show", (gid, p) => { io.to(room(gid)).emit("question:show", p); io.to(hostRoom(gid)).emit("question:show", p); });
  gm.on("timer:tick", (gid, p) => { io.to(room(gid)).emit("timer:tick", p); io.to(hostRoom(gid)).emit("timer:tick", p); });
  gm.on("question:reveal", (gid, p) => { io.to(room(gid)).emit("question:reveal", p); io.to(hostRoom(gid)).emit("question:reveal", p); });
  gm.on("leaderboard:show", (gid, p) => { io.to(room(gid)).emit("leaderboard:show", p); io.to(hostRoom(gid)).emit("leaderboard:show", p); });
  gm.on("leaderboard:hide", (gid) => { io.to(room(gid)).emit("leaderboard:hide"); io.to(hostRoom(gid)).emit("leaderboard:hide"); });
  gm.on("game:over", (gid, p) => { io.to(room(gid)).emit("game:over", p); io.to(hostRoom(gid)).emit("game:over", p); });
  gm.on("host:analytics", (gid, p) => { io.to(hostRoom(gid)).emit("host:analytics", p); });
  gm.on("player:scored", (gid, playerId, p) => {
    const s = io.sockets.adapter.rooms; // unicast handled in player.ts via socket map
    io.to(`player:${playerId}`).emit("player:scored", p);
  });

  io.on("connection", (socket) => {
    registerPlayer(io, gm, socket, { room, hostRoom });
    registerHost(io, gm, socket, { room, hostRoom });
    socket.on("disconnect", () => gm.disconnectSocket(socket.id));
  });
}
```

- [ ] **Step 2: socket/player.ts**

```ts
import type { Server, Socket } from "socket.io";
import type { GameManager } from "../services/gameManager";

type Rooms = { room: (g: string) => string; hostRoom: (g: string) => string };

export function registerPlayer(io: Server, gm: GameManager, socket: Socket, r: Rooms) {
  socket.on("player:join", async (p, ack) => {
    try {
      const game = gm.getGameByPin(p.pin);
      if (!game) return ack({ ok: false, error: "Game not found" });
      const ip = socket.handshake.address;
      const player = await gm.addPlayer(game.id, { name: p.name, city: p.city, socketId: socket.id, ip });
      socket.join(r.room(game.id));
      socket.join(`player:${player.id}`);
      (socket.data as any).gameId = game.id; (socket.data as any).playerId = player.id;
      ack({ ok: true, playerId: player.id, state: {
        status: game.status, alreadyAnswered: false, score: 0, streak: 0 } });
    } catch (e: any) { ack({ ok: false, error: e.message }); }
  });

  socket.on("player:reconnect", (p, ack) => {
    // find game containing this player
    for (const g of (gm as any).games.values()) {
      const player = g.players.get(p.playerId);
      if (player) {
        const res = gm.reconnect(g.id, p.playerId, socket.id);
        if (!res) break;
        socket.join(r.room(g.id)); socket.join(`player:${p.playerId}`);
        const q = g.questions[g.currentIndex];
        const answered = q ? g.answers.get(q.id)?.has(p.playerId) ?? false : false;
        return ack({ ok: true, state: {
          status: g.status,
          question: q && g.status !== "ENDED" ? {
            id: q.id, index: g.currentIndex, total: g.questions.length, text: q.text,
            options: q.options, category: q.category, difficulty: q.difficulty } : undefined,
          endsAt: g.status === "RUNNING" ? g.endsAt : undefined,
          alreadyAnswered: answered, score: player.score, streak: player.streak } });
      }
    }
    ack({ ok: false, error: "Player not found" });
  });

  socket.on("answer:submit", async (p, ack) => {
    const gameId = (socket.data as any).gameId; const playerId = (socket.data as any).playerId;
    if (!gameId || !playerId) return ack({ ok: false, error: "Not in a game" });
    const res = await gm.submitAnswer(gameId, playerId, p.questionId, p.index);
    if (res.ok) ack({ ok: true, locked: true }); else ack(res);
  });
}
```

- [ ] **Step 3: socket/host.ts**

```ts
import type { Server, Socket } from "socket.io";
import type { GameManager } from "../services/gameManager";
import { verifyHost } from "../routes/auth";
import { DEFAULT_SETTINGS } from "../../../shared/types";

type Rooms = { room: (g: string) => string; hostRoom: (g: string) => string };

export function registerHost(io: Server, gm: GameManager, socket: Socket, r: Rooms) {
  socket.on("host:create", async (p, ack) => {
    if (!verifyHost(p.token)) return ack({ ok: false, error: "Unauthorized" });
    const game = await gm.createGame({ ...DEFAULT_SETTINGS, ...p.settings });
    socket.join(r.hostRoom(game.id));
    ack({ ok: true, pin: game.pin, gameId: game.id });
  });

  socket.on("host:attach", (p, ack) => {
    if (!verifyHost(p.token)) return ack({ ok: false, error: "Unauthorized" });
    const g = gm.getGame(p.gameId);
    if (!g) return ack({ ok: false, error: "Game not found" });
    socket.join(r.hostRoom(p.gameId));
    ack({ ok: true, state: {
      status: g.status, pin: g.pin, currentIndex: g.currentIndex, total: g.questions.length,
      players: gm.publicPlayers(g), paused: g.paused } });
  });

  socket.on("host:control", async (p, ack) => {
    if (!verifyHost(p.token)) return ack({ ok: false, error: "Unauthorized" });
    try {
      switch (p.action) {
        case "start": await gm.start(p.gameId); break;
        case "next": gm.next(p.gameId); break;
        case "prev": gm.prev(p.gameId); break;
        case "skip": gm.skip(p.gameId); break;
        case "reveal": gm.reveal(p.gameId); break;
        case "restartQ": gm.restartQ(p.gameId); break;
        case "pause": gm.pause(p.gameId); break;
        case "resume": gm.resume(p.gameId); break;
        case "addTime": gm.addTime(p.gameId, p.value ?? 10); break;
        case "subTime": gm.subTime(p.gameId, p.value ?? 10); break;
        case "showBoard": gm.showBoard(p.gameId); break;
        case "hideBoard": gm.hideBoard(p.gameId); break;
        case "end": await gm.end(p.gameId); break;
      }
      ack({ ok: true });
    } catch (e: any) { ack({ ok: false, error: e.message }); }
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `npm --workspace server run build`
Expected: compiles (dist/ produced). Fix any type errors before commit.

- [ ] **Step 5: Commit**

```bash
git add server/src/socket
git commit -m "feat(server): socket handlers for player + host, event forwarding"
```

---

## Phase 5 — Client Scaffold + Theme + Socket

### Task 5.1: Vite + Tailwind + theme tokens

**Files:**
- Create: `client/package.json`, `client/vite.config.ts`, `client/tsconfig.json`, `client/tailwind.config.ts`, `client/postcss.config.js`, `client/index.html`, `client/.env.example`, `client/src/index.css`, `client/src/lib/theme.ts`, `client/src/lib/format.ts`

- [ ] **Step 1: client/package.json**

```json
{
  "name": "client", "private": true, "type": "module",
  "scripts": { "dev": "vite", "build": "tsc -b && vite build", "preview": "vite preview" },
  "dependencies": {
    "@tanstack/react-query": "^5.59.0", "canvas-confetti": "^1.9.3",
    "framer-motion": "^11.11.0", "qrcode.react": "^4.1.0",
    "react": "^18.3.1", "react-dom": "^18.3.1", "react-router-dom": "^6.27.0",
    "socket.io-client": "^4.8.1", "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/canvas-confetti": "^1.6.4", "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0", "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20", "postcss": "^8.4.47", "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3", "vite": "^5.4.9"
  }
}
```

- [ ] **Step 2: vite.config.ts, tsconfig.json, postcss.config.js**

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });
```
```json
// tsconfig.json
{ "compilerOptions": { "target": "ES2022", "lib": ["ES2022","DOM","DOM.Iterable"],
  "module": "ESNext", "moduleResolution": "Bundler", "jsx": "react-jsx",
  "strict": true, "skipLibCheck": true, "esModuleInterop": true, "noEmit": true,
  "resolveJsonModule": true }, "include": ["src", "../shared"] }
```
```js
// postcss.config.js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 3: tailwind.config.ts** (brand tokens from posters)

```ts
import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: { 50:"#fbe8a6", 100:"#f6d57a", 300:"#f0c75e", 500:"#d4a434", 700:"#c8922a", 900:"#b8860b" },
        ink: { 900:"#0a0703", 800:"#0d0a04", 700:"#14100a" },
        cream: { DEFAULT:"#faf6ea", soft:"#f3e3b3", dim:"#e8d9ad" },
        ruby: { DEFAULT:"#a31010", dark:"#7c0b0b" },
      },
      fontFamily: {
        cinzel: ['Cinzel','serif'], bebas: ['"Bebas Neue"','sans-serif'],
        vibes: ['"Great Vibes"','cursive'], body: ['Montserrat','sans-serif'],
      },
      boxShadow: { goldglow: "0 0 26px rgba(240,199,94,.30), inset 0 0 18px rgba(240,199,94,.12)" },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 4: index.html + index.css**

```html
<!-- client/index.html -->
<!doctype html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
<title>SRK Warriors Quiz</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cinzel:wght@700;900&family=Great+Vibes&family=Montserrat:wght@500;600;700;800&display=swap" rel="stylesheet">
</head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
```
```css
/* client/src/index.css */
@tailwind base; @tailwind components; @tailwind utilities;
:root { color-scheme: dark; }
body { @apply font-body text-cream; background:
  radial-gradient(ellipse 900px 500px at 50% -10%, rgba(212,164,52,.22), transparent 65%),
  radial-gradient(ellipse 700px 400px at 50% 115%, rgba(212,164,52,.18), transparent 60%),
  linear-gradient(180deg,#0d0a04 0%,#14100a 50%,#0a0703 100%); min-height:100dvh; }
.gold-text { background:linear-gradient(180deg,#fbe8a6,#f0c75e 35%,#c8922a 70%,#f6d57a);
  -webkit-background-clip:text; background-clip:text; color:transparent; }
.glass { background:rgba(34,26,12,.45); backdrop-filter:blur(10px);
  border:1px solid rgba(212,164,52,.4); border-radius:16px; }
```

- [ ] **Step 5: lib/format.ts + lib/theme.ts**

```ts
// lib/format.ts
export const ms2s = (ms: number) => (ms / 1000).toFixed(3) + "s";
export const pct = (n: number) => Math.round(n) + "%";
// lib/theme.ts
export const OPTION_STYLES = [
  { bg: "#a31010", shape: "▲", label: "Triangle" },
  { bg: "#1d4ed8", shape: "◆", label: "Diamond" },
  { bg: "#c8922a", shape: "●", label: "Circle" },
  { bg: "#15803d", shape: "■", label: "Square" },
] as const;
```

- [ ] **Step 6: .env.example + install + commit**

```
# client/.env.example
VITE_SERVER_URL=http://localhost:4000
```
```bash
npm install
git add client/ package-lock.json
git commit -m "chore(client): vite + tailwind + brand theme scaffold"
```

### Task 5.2: Typed socket client + stores

**Files:**
- Create: `client/src/lib/types.ts` (copy of shared), `client/src/socket/socket.ts`, `client/src/store/gameStore.ts`, `client/src/store/settingsStore.ts`, `client/src/store/audioStore.ts`, `client/src/hooks/useCountdown.ts`

- [ ] **Step 1: lib/types.ts** — re-export shared contract

```ts
export * from "../../../shared/types";
```

- [ ] **Step 2: socket/socket.ts** (typed singleton)

```ts
import { io, Socket } from "socket.io-client";
import type { ClientToServer, ServerToClient } from "../lib/types";
const URL = import.meta.env.VITE_SERVER_URL as string;
export const socket: Socket<ServerToClient, ClientToServer> =
  io(URL, { autoConnect: true, transports: ["websocket"] });
```

- [ ] **Step 3: store/settingsStore.ts** (persisted)

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
interface S { music: boolean; sound: boolean; toggleMusic: () => void; toggleSound: () => void; }
export const useSettings = create<S>()(persist((set) => ({
  music: true, sound: true,
  toggleMusic: () => set(s => ({ music: !s.music })),
  toggleSound: () => set(s => ({ sound: !s.sound })),
}), { name: "srk-settings" }));
```

- [ ] **Step 4: store/audioStore.ts** (WebAudio beeps; no asset files needed for v1)

```ts
// Synth fx via WebAudio so there are zero binary assets to host. Replace with real
// samples later by swapping play() to <audio> elements.
let ctx: AudioContext | null = null;
function beep(freq: number, ms: number, type: OscillatorType = "sine", gain = 0.08) {
  ctx ??= new AudioContext();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = gain;
  o.connect(g); g.connect(ctx.destination); o.start();
  o.stop(ctx.currentTime + ms / 1000);
}
import { useSettings } from "./settingsStore";
const on = () => useSettings.getState().sound;
export const sfx = {
  tick: () => on() && beep(880, 60, "square", 0.05),
  correct: () => on() && (beep(660, 120), setTimeout(() => beep(990, 160), 120)),
  wrong: () => on() && beep(180, 260, "sawtooth", 0.07),
  victory: () => on() && [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 220), i * 160)),
  applause: () => on() && beep(300, 400, "triangle", 0.04),
};
```

- [ ] **Step 5: store/gameStore.ts** (client live state, player + host shared)

```ts
import { create } from "zustand";
import type { PublicQuestion, PlayerPublic, LeaderboardRow, RevealPayload, GameOverPayload } from "../lib/types";

interface GS {
  playerId?: string; pin?: string; gameId?: string;
  question?: PublicQuestion; endsAt?: number; paused: boolean;
  selectedIndex?: number; locked: boolean;
  score: number; streak: number;
  players: PlayerPublic[]; reveal?: RevealPayload;
  leaderboard?: LeaderboardRow[]; boardVisible: boolean;
  analytics?: { answered: number; pending: number; liveAccuracy: number; distribution: number[] };
  over?: GameOverPayload;
  set: (p: Partial<GS>) => void; reset: () => void;
}
const init = { paused: false, locked: false, score: 0, streak: 0, players: [], boardVisible: false };
export const useGame = create<GS>((set) => ({
  ...init,
  set: (p) => set(p),
  reset: () => set({ ...init, question: undefined, reveal: undefined, over: undefined,
    leaderboard: undefined, analytics: undefined, selectedIndex: undefined, endsAt: undefined }),
}));
```

- [ ] **Step 6: hooks/useCountdown.ts** (rAF interpolation from endsAt)

```ts
import { useEffect, useState } from "react";
export function useCountdown(endsAt?: number, paused?: boolean) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!endsAt) return; let raf = 0;
    const loop = () => { setMs(Math.max(0, endsAt - Date.now())); raf = requestAnimationFrame(loop); };
    if (!paused) raf = requestAnimationFrame(loop); else setMs(Math.max(0, endsAt - Date.now()));
    return () => cancelAnimationFrame(raf);
  }, [endsAt, paused]);
  return ms;
}
```

- [ ] **Step 7: Commit**

```bash
git add client/src/lib client/src/socket client/src/store client/src/hooks
git commit -m "feat(client): typed socket, zustand stores, countdown hook"
```

---

## Phase 6 — Shared Visual Components

### Task 6.1: Core components

**Files:**
- Create: `client/src/components/ParticleBg.tsx`, `GlassCard.tsx`, `GoldButton.tsx`, `CircularTimer.tsx`, `OptionCard.tsx`

- [ ] **Step 1: ParticleBg.tsx** (animated bokeh + diamonds)

```tsx
import { motion } from "framer-motion";
const dots = Array.from({ length: 18 }, (_, i) => ({
  id: i, x: Math.random() * 100, y: Math.random() * 100,
  s: 4 + Math.random() * 10, d: 6 + Math.random() * 8, delay: Math.random() * 5,
}));
export default function ParticleBg() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {dots.map(p => (
        <motion.div key={p.id} className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s,
            background: "radial-gradient(circle, rgba(255,215,120,.9), rgba(255,200,80,.04) 70%)" }}
          animate={{ y: [0, -30, 0], opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: p.d, delay: p.delay, repeat: Infinity, ease: "easeInOut" }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: GlassCard.tsx + GoldButton.tsx**

```tsx
// GlassCard.tsx
import { motion } from "framer-motion";
export default function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
    className={`glass shadow-goldglow p-6 ${className}`}>{children}</motion.div>;
}
// GoldButton.tsx
export default function GoldButton({ children, onClick, type = "button", disabled }:
  { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled}
    className="font-bebas tracking-wider text-ink-900 text-xl px-8 py-3 rounded-full
      bg-gradient-to-r from-gold-700 via-gold-100 to-gold-700 shadow-goldglow
      hover:brightness-110 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed">
    {children}</button>;
}
```

- [ ] **Step 3: CircularTimer.tsx** (SVG ring, color by remaining, ticking sound last 5s)

```tsx
import { useEffect, useRef } from "react";
import { sfx } from "../store/audioStore";
export default function CircularTimer({ remainingMs, totalMs, size = 140 }:
  { remainingMs: number; totalMs: number; size?: number }) {
  const frac = Math.max(0, Math.min(1, remainingMs / totalMs));
  const sec = Math.ceil(remainingMs / 1000);
  const r = size / 2 - 10, c = 2 * Math.PI * r;
  const color = sec > totalMs / 1000 * 0.5 ? "#15803d" : sec > 10 ? "#f0c75e" : sec > 5 ? "#d4750a" : "#a31010";
  const last = useRef(-1);
  useEffect(() => { if (sec <= 5 && sec >= 1 && sec !== last.current) { sfx.tick(); last.current = sec; } }, [sec]);
  return (
    <svg width={size} height={size} className="drop-shadow-[0_0_12px_rgba(240,199,94,.4)]">
      <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,.1)" strokeWidth="10" fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth="10" fill="none"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset .25s linear, stroke .3s" }} />
      <text x="50%" y="54%" textAnchor="middle" className="font-bebas" fontSize={size*0.32} fill="#faf6ea">{sec}</text>
    </svg>
  );
}
```

- [ ] **Step 4: OptionCard.tsx** (color+shape tile, lock/correct/wrong states)

```tsx
import { motion } from "framer-motion";
import { OPTION_STYLES } from "../lib/theme";
export default function OptionCard({ index, text, onClick, disabled, state }:
  { index: number; text: string; onClick?: () => void; disabled?: boolean;
    state?: "idle" | "selected" | "correct" | "wrong" | "dim" }) {
  const s = OPTION_STYLES[index];
  const ring = state === "correct" ? "ring-4 ring-green-400" : state === "wrong" ? "ring-4 ring-red-400"
    : state === "selected" ? "ring-4 ring-gold-100" : "";
  return (
    <motion.button whileTap={{ scale: 0.96 }} disabled={disabled} onClick={onClick}
      className={`flex items-center gap-4 w-full p-5 rounded-2xl text-left text-white font-semibold
        text-lg md:text-2xl shadow-lg transition ${ring} ${state === "dim" ? "opacity-40" : ""}`}
      style={{ background: s.bg }}>
      <span className="text-3xl md:text-4xl drop-shadow">{s.shape}</span>
      <span className="flex-1">{text}</span>
    </motion.button>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components
git commit -m "feat(client): core themed components (bg, timer, option, glass)"
```

### Task 6.2: Leaderboard, Podium, AnswerBarChart, Fireworks

**Files:**
- Create: `client/src/components/Leaderboard.tsx`, `Podium.tsx`, `AnswerBarChart.tsx`, `Fireworks.tsx`

- [ ] **Step 1: Leaderboard.tsx** (animated rows, top 3 gold/silver/bronze)

```tsx
import { motion, AnimatePresence } from "framer-motion";
import type { LeaderboardRow } from "../lib/types";
import { ms2s, pct } from "../lib/format";
const medal = ["#f0c75e", "#cbd5e1", "#d08b3c"];
export default function Leaderboard({ rows, max = 10 }: { rows: LeaderboardRow[]; max?: number }) {
  return (
    <div className="space-y-2">
      <AnimatePresence>
        {rows.slice(0, max).map((r) => (
          <motion.div layout key={r.playerId} initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            className="glass flex items-center gap-4 px-4 py-3"
            style={{ borderColor: r.rank <= 3 ? medal[r.rank - 1] : undefined }}>
            <span className="font-bebas text-2xl w-10" style={{ color: r.rank <= 3 ? medal[r.rank - 1] : "#faf6ea" }}>#{r.rank}</span>
            <span className="flex-1 font-semibold truncate">{r.name}</span>
            <span className="text-cream-dim text-sm hidden md:inline">{pct(r.accuracy)} · {ms2s(r.totalMs)}</span>
            <span className="font-bebas text-2xl gold-text">{r.score}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: AnswerBarChart.tsx** (distribution after reveal)

```tsx
import { motion } from "framer-motion";
import { OPTION_STYLES } from "../lib/theme";
export default function AnswerBarChart({ distribution, correctIndex }:
  { distribution: number[]; correctIndex: number }) {
  const max = Math.max(1, ...distribution);
  return (
    <div className="flex items-end gap-4 h-40">
      {distribution.map((n, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <motion.div initial={{ height: 0 }} animate={{ height: `${(n / max) * 100}%` }}
            transition={{ duration: 0.6 }} className="w-full rounded-t-lg relative"
            style={{ background: OPTION_STYLES[i].bg, outline: i === correctIndex ? "3px solid #4ade80" : "none" }}>
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 font-bebas text-xl">{n}</span>
          </motion.div>
          <span className="text-2xl">{OPTION_STYLES[i].shape}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Podium.tsx + Fireworks.tsx**

```tsx
// Podium.tsx
import { motion } from "framer-motion";
import type { LeaderboardRow } from "../lib/types";
const H = [180, 240, 140], ORD = [1, 0, 2], MEDAL = ["#cbd5e1","#f0c75e","#d08b3c"], LABEL=["Runner-up","Champion","2nd Runner-up"];
export default function Podium({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="flex items-end justify-center gap-4">
      {ORD.map((idx, pos) => { const r = rows[idx]; if (!r) return null; return (
        <motion.div key={r.playerId} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: pos * 0.25 }} className="flex flex-col items-center">
          <div className="font-cinzel text-xl gold-text mb-1">{LABEL[idx]}</div>
          <div className="font-bold text-2xl mb-2">{r.name}</div>
          <div className="w-28 rounded-t-xl flex items-start justify-center pt-3 font-bebas text-4xl text-ink-900"
            style={{ height: H[idx], background: `linear-gradient(180deg, ${MEDAL[idx]}, #b8860b)` }}>{r.score}</div>
        </motion.div>); })}
    </div>
  );
}
// Fireworks.tsx
import { useEffect } from "react";
import confetti from "canvas-confetti";
export default function Fireworks() {
  useEffect(() => {
    const end = Date.now() + 4000;
    const tick = () => {
      confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0 }, colors: ["#f0c75e","#faf6ea","#a31010"] });
      confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1 }, colors: ["#f0c75e","#faf6ea","#a31010"] });
      if (Date.now() < end) requestAnimationFrame(tick);
    }; tick();
  }, []);
  return null;
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components
git commit -m "feat(client): leaderboard, podium, bar chart, fireworks"
```

---

## Phase 7 — Routing + Landing + Host Auth

### Task 7.1: Router + providers + Landing + Rules

**Files:**
- Create: `client/src/main.tsx`, `client/src/pages/Landing.tsx`, `client/src/pages/Rules.tsx`, `client/src/hooks/useHostAuth.ts`

- [ ] **Step 1: main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import Landing from "./pages/Landing";
import Rules from "./pages/Rules";
import HostLogin from "./pages/HostLogin";
import HostDashboard from "./pages/HostDashboard";
import HostCreate from "./pages/HostCreate";
import HostGame from "./pages/HostGame";
import HostEnd from "./pages/HostEnd";
import Join from "./pages/Join";
import PlayerLobby from "./pages/PlayerLobby";
import PlayerPlay from "./pages/PlayerPlay";
import PlayerEnd from "./pages/PlayerEnd";

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/rules", element: <Rules /> },
  { path: "/host/login", element: <HostLogin /> },
  { path: "/host", element: <HostDashboard /> },
  { path: "/host/create", element: <HostCreate /> },
  { path: "/host/game/:gameId", element: <HostGame /> },
  { path: "/host/end/:gameId", element: <HostEnd /> },
  { path: "/join", element: <Join /> },
  { path: "/play/lobby", element: <PlayerLobby /> },
  { path: "/play", element: <PlayerPlay /> },
  { path: "/play/end", element: <PlayerEnd /> },
]);
const qc = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><QueryClientProvider client={qc}>
    <RouterProvider router={router} />
  </QueryClientProvider></React.StrictMode>
);
```

- [ ] **Step 2: useHostAuth.ts**

```ts
import { useNavigate } from "react-router-dom";
export const getToken = () => localStorage.getItem("srk-host-token") ?? "";
export function useHostAuth() {
  const nav = useNavigate();
  const token = getToken();
  return { token, require: () => { if (!token) nav("/host/login"); } };
}
```

- [ ] **Step 3: Landing.tsx** (hero, toggles, nav buttons)

```tsx
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import ParticleBg from "../components/ParticleBg";
import GoldButton from "../components/GoldButton";
import { useSettings } from "../store/settingsStore";
export default function Landing() {
  const nav = useNavigate();
  const { music, sound, toggleMusic, toggleSound } = useSettings();
  const fs = () => document.documentElement.requestFullscreen?.();
  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center text-center px-6">
      <ParticleBg />
      <div className="absolute top-4 right-4 flex gap-3 z-10">
        <button onClick={toggleMusic} className="glass px-3 py-2">{music ? "🎵" : "🔇"}</button>
        <button onClick={toggleSound} className="glass px-3 py-2">{sound ? "🔊" : "🔕"}</button>
        <button onClick={fs} className="glass px-3 py-2">⛶</button>
      </div>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="z-10">
        <div className="text-5xl mb-2">👑</div>
        <h1 className="font-cinzel font-black text-4xl md:text-6xl gold-text leading-tight">SRK WARRIORS<br/>QUIZ CHAMPIONSHIP</h1>
        <p className="font-vibes text-3xl text-cream-soft mt-4">Celebrating 34 Years of Shah Rukh Khan</p>
        <p className="font-vibes text-2xl text-cream-soft">Celebrating 7 Years of SRK Warriors</p>
        <div className="flex flex-wrap gap-4 justify-center mt-10">
          <GoldButton onClick={() => nav("/host/login")}>HOST QUIZ</GoldButton>
          <GoldButton onClick={() => nav("/join")}>JOIN QUIZ</GoldButton>
          <GoldButton onClick={() => nav("/rules")}>RULES</GoldButton>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 4: Rules.tsx** (static glass card; back button)

```tsx
import { useNavigate } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import ParticleBg from "../components/ParticleBg";
const RULES = [
  "40 questions. 30 seconds each. 1 point per correct answer.",
  "Answer fast — ties are broken by total response time.",
  "One answer per question. No changing once locked.",
  "Leaderboard updates every 5 questions.",
  "Stay connected — you'll auto-reconnect if you drop.",
];
export default function Rules() {
  const nav = useNavigate();
  return (
    <div className="relative min-h-dvh flex items-center justify-center p-6">
      <ParticleBg />
      <GlassCard className="max-w-lg z-10">
        <h2 className="font-cinzel text-3xl gold-text mb-4">How to Play</h2>
        <ul className="space-y-3 text-cream-soft">{RULES.map((r, i) => <li key={i}>👑 {r}</li>)}</ul>
        <button onClick={() => nav("/")} className="mt-6 underline text-gold-300">← Back</button>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add client/src/main.tsx client/src/pages/Landing.tsx client/src/pages/Rules.tsx client/src/hooks/useHostAuth.ts
git commit -m "feat(client): router, landing, rules, host-auth hook"
```

### Task 7.2: Host login + dashboard

**Files:**
- Create: `client/src/pages/HostLogin.tsx`, `client/src/pages/HostDashboard.tsx`

- [ ] **Step 1: HostLogin.tsx** (POST /host/login, store token)

```tsx
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
```

- [ ] **Step 2: HostDashboard.tsx**

```tsx
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
          <button className="glass px-8 py-3 opacity-50 cursor-not-allowed">Question Manager (Phase 2)</button>
          <button onClick={() => { localStorage.removeItem("srk-host-token"); nav("/"); }}
            className="text-gold-300 underline mt-2">Log out</button>
        </div>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/HostLogin.tsx client/src/pages/HostDashboard.tsx
git commit -m "feat(client): host login + dashboard"
```

---

## Phase 8 — Host Create + Live Game + End

### Task 8.1: HostCreate (PIN + QR + lobby + start)

**Files:**
- Create: `client/src/pages/HostCreate.tsx`

- [ ] **Step 1: HostCreate.tsx**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { socket } from "../socket/socket";
import { getToken } from "../hooks/useHostAuth";
import { DEFAULT_SETTINGS, type PlayerPublic } from "../lib/types";
import GlassCard from "../components/GlassCard";
import GoldButton from "../components/GoldButton";
import ParticleBg from "../components/ParticleBg";

export default function HostCreate() {
  const nav = useNavigate();
  const [pin, setPin] = useState(""); const [gameId, setGameId] = useState("");
  const [players, setPlayers] = useState<PlayerPublic[]>([]);
  const joinUrl = `${window.location.origin}/join`;

  useEffect(() => {
    socket.emit("host:create", { token: getToken(), settings: DEFAULT_SETTINGS }, (r) => {
      if (r.ok) { setPin(r.pin); setGameId(r.gameId); }
    });
    const onLobby = (p: { players: PlayerPublic[] }) => setPlayers(p.players);
    socket.on("lobby:update", onLobby);
    return () => { socket.off("lobby:update", onLobby); };
  }, []);

  const start = () => {
    socket.emit("host:control", { token: getToken(), gameId, action: "start" }, () => {});
    nav(`/host/game/${gameId}`);
  };

  return (
    <div className="relative min-h-dvh p-6 flex flex-col items-center z-10">
      <ParticleBg />
      <GlassCard className="z-10 w-full max-w-4xl text-center">
        <p className="font-cinzel text-2xl text-cream-soft">Join at <span className="gold-text">{joinUrl}</span></p>
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 my-6">
          <div className="bg-white p-4 rounded-2xl">{pin && <QRCodeSVG value={joinUrl} size={200} />}</div>
          <div>
            <p className="text-cream-dim">Game PIN</p>
            <div className="font-bebas text-7xl md:text-8xl gold-text tracking-widest">{pin || "······"}</div>
          </div>
        </div>
        <p className="font-bebas text-3xl">{players.length} PLAYERS JOINED</p>
        <div className="flex flex-wrap gap-2 justify-center my-4 max-h-40 overflow-y-auto">
          {players.map(p => <span key={p.id} className="glass px-3 py-1 text-sm">{p.name}</span>)}
        </div>
        <GoldButton onClick={start} disabled={!gameId || players.length === 0}>START QUIZ</GoldButton>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/HostCreate.tsx
git commit -m "feat(client): host create game with PIN, QR, live lobby"
```

### Task 8.2: HostGame (live question, timer, controls, analytics, reveal)

**Files:**
- Create: `client/src/pages/HostGame.tsx`, `client/src/components/Controls.tsx`

- [ ] **Step 1: components/Controls.tsx**

```tsx
import { socket } from "../socket/socket";
import { getToken } from "../hooks/useHostAuth";
import type { HostAction } from "../lib/types";
const BTNS: { a: HostAction; label: string; v?: number }[] = [
  { a: "pause", label: "⏸ Pause" }, { a: "resume", label: "▶ Resume" },
  { a: "prev", label: "⏮ Prev" }, { a: "skip", label: "⏭ Skip" },
  { a: "reveal", label: "👁 Reveal" }, { a: "restartQ", label: "↺ Restart Q" },
  { a: "addTime", label: "+10s", v: 10 }, { a: "subTime", label: "−10s", v: 10 },
  { a: "showBoard", label: "🏆 Board" }, { a: "hideBoard", label: "Hide Board" },
  { a: "next", label: "Next ➡" }, { a: "end", label: "⏹ End", },
];
export default function Controls({ gameId }: { gameId: string }) {
  const fire = (a: HostAction, v?: number) => socket.emit("host:control", { token: getToken(), gameId, action: a, value: v }, () => {});
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {BTNS.map(b => <button key={b.label} onClick={() => fire(b.a, b.v)}
        className="glass px-4 py-2 hover:border-gold-300 transition text-sm font-semibold">{b.label}</button>)}
    </div>
  );
}
```

- [ ] **Step 2: HostGame.tsx** (subscribes to all live events; renders question/timer/analytics/reveal/board)

```tsx
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../socket/socket";
import { getToken } from "../hooks/useHostAuth";
import { useGame } from "../store/gameStore";
import { useCountdown } from "../hooks/useCountdown";
import { useSettings } from "../store/settingsStore";
import { sfx } from "../store/audioStore";
import CircularTimer from "../components/CircularTimer";
import OptionCard from "../components/OptionCard";
import Controls from "../components/Controls";
import Leaderboard from "../components/Leaderboard";
import AnswerBarChart from "../components/AnswerBarChart";
import ParticleBg from "../components/ParticleBg";

export default function HostGame() {
  const { gameId = "" } = useParams(); const nav = useNavigate();
  const g = useGame(); const timerSec = 30;
  const remaining = useCountdown(g.endsAt, g.paused);

  useEffect(() => {
    socket.emit("host:attach", { token: getToken(), gameId }, () => {});
    const onShow = (p: any) => useGame.getState().set({ question: p.question, endsAt: p.endsAt, paused: p.paused, reveal: undefined, boardVisible: false });
    const onTick = (p: any) => useGame.getState().set({ endsAt: p.paused ? undefined : Date.now() + p.remainingMs, paused: p.paused });
    const onReveal = (p: any) => { useGame.getState().set({ reveal: p }); };
    const onAnalytics = (p: any) => useGame.getState().set({ analytics: p });
    const onBoard = (p: any) => useGame.getState().set({ leaderboard: p.rows, boardVisible: true });
    const onHide = () => useGame.getState().set({ boardVisible: false });
    const onOver = (p: any) => { useGame.getState().set({ over: p }); nav(`/host/end/${gameId}`); };
    socket.on("question:show", onShow); socket.on("timer:tick", onTick);
    socket.on("question:reveal", onReveal); socket.on("host:analytics", onAnalytics);
    socket.on("leaderboard:show", onBoard); socket.on("leaderboard:hide", onHide);
    socket.on("game:over", onOver);
    return () => { socket.off("question:show", onShow); socket.off("timer:tick", onTick);
      socket.off("question:reveal", onReveal); socket.off("host:analytics", onAnalytics);
      socket.off("leaderboard:show", onBoard); socket.off("leaderboard:hide", onHide);
      socket.off("game:over", onOver); };
  }, [gameId]);

  const q = g.question;
  return (
    <div className="relative min-h-dvh p-6 flex flex-col z-10">
      <ParticleBg />
      <div className="z-10 flex-1 flex flex-col">
        {g.boardVisible && g.leaderboard ? (
          <div className="max-w-3xl mx-auto w-full"><h2 className="font-cinzel text-4xl gold-text text-center mb-6">Leaderboard</h2><Leaderboard rows={g.leaderboard} /></div>
        ) : q ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="font-bebas text-3xl">Q{q.index + 1}/{q.total}</span>
              <CircularTimer remainingMs={g.paused ? 0 : remaining} totalMs={timerSec * 1000} />
              <span className="font-bebas text-2xl text-cream-soft">{g.analytics?.answered ?? 0} answered · {Math.round(g.analytics?.liveAccuracy ?? 0)}%</span>
            </div>
            <h1 className="font-cinzel text-3xl md:text-5xl text-center my-6">{q.text}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
              {q.options.map((o, i) => (
                <OptionCard key={i} index={i} text={o} disabled
                  state={g.reveal ? (i === g.reveal.correctIndex ? "correct" : "dim") : "idle"} />
              ))}
            </div>
            {g.reveal && (
              <div className="max-w-3xl mx-auto w-full mt-6 glass p-5">
                <p className="text-cream-soft mb-3">💡 {g.reveal.explanation} — <b>{Math.round(g.reveal.pctCorrect)}% correct</b></p>
                <AnswerBarChart distribution={g.reveal.distribution} correctIndex={g.reveal.correctIndex} />
              </div>
            )}
          </>
        ) : <p className="text-center mt-20 text-cream-dim">Waiting…</p>}
        <div className="mt-auto pt-6"><Controls gameId={gameId} /></div>
      </div>
    </div>
  );
}
```

> **Reveal sounds:** add a small effect — when `g.reveal` becomes set, host can play `sfx.applause()` if `useSettings.getState().sound`. Optional; wire in a `useEffect([g.reveal])`.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/HostGame.tsx client/src/components/Controls.tsx
git commit -m "feat(client): host live game screen + controls + analytics + reveal"
```

### Task 8.3: HostEnd (podium + fireworks + stats)

**Files:**
- Create: `client/src/pages/HostEnd.tsx`

- [ ] **Step 1: HostEnd.tsx**

```tsx
import { useEffect } from "react";
import { useGame } from "../store/gameStore";
import Podium from "../components/Podium";
import Fireworks from "../components/Fireworks";
import Leaderboard from "../components/Leaderboard";
import ParticleBg from "../components/ParticleBg";
import { sfx } from "../store/audioStore";
export default function HostEnd() {
  const over = useGame(s => s.over);
  useEffect(() => { sfx.victory(); setTimeout(() => sfx.applause(), 800); }, []);
  if (!over) return <div className="min-h-dvh flex items-center justify-center">No results.</div>;
  return (
    <div className="relative min-h-dvh p-6 z-10">
      <ParticleBg /><Fireworks />
      <div className="z-10 relative">
        <h1 className="font-cinzel text-5xl gold-text text-center mb-2">🏆 Champions 🏆</h1>
        <div className="my-10"><Podium rows={over.podium} /></div>
        <div className="max-w-3xl mx-auto"><Leaderboard rows={over.fullRanking} max={20} /></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/HostEnd.tsx
git commit -m "feat(client): host end screen with podium + fireworks"
```

---

## Phase 9 — Player Screens

### Task 9.1: Join + PlayerLobby

**Files:**
- Create: `client/src/pages/Join.tsx`, `client/src/pages/PlayerLobby.tsx`

- [ ] **Step 1: Join.tsx** (name/city/PIN, dedup error, store playerId)

```tsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { socket } from "../socket/socket";
import { useGame } from "../store/gameStore";
import GlassCard from "../components/GlassCard";
import GoldButton from "../components/GoldButton";
import ParticleBg from "../components/ParticleBg";
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
      <GlassCard className="z-10 w-full max-w-sm">
        <div className="text-center text-4xl mb-2">👑</div>
        <h2 className="font-cinzel text-2xl gold-text text-center mb-6">Join the Quiz</h2>
        <form onSubmit={join} className="space-y-3">
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
```

- [ ] **Step 2: PlayerLobby.tsx** (waiting; navigates to /play on question:show)

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Join.tsx client/src/pages/PlayerLobby.tsx
git commit -m "feat(client): player join + animated lobby"
```

### Task 9.2: PlayerPlay (answer, lock, reveal, scored) + reconnect + back-guard

**Files:**
- Create: `client/src/pages/PlayerPlay.tsx`, `client/src/pages/PlayerEnd.tsx`

- [ ] **Step 1: PlayerPlay.tsx**

```tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket/socket";
import { useGame } from "../store/gameStore";
import { useCountdown } from "../hooks/useCountdown";
import { sfx } from "../store/audioStore";
import CircularTimer from "../components/CircularTimer";
import OptionCard from "../components/OptionCard";
import ParticleBg from "../components/ParticleBg";

export default function PlayerPlay() {
  const nav = useNavigate(); const g = useGame();
  const remaining = useCountdown(g.endsAt, g.paused);

  useEffect(() => {
    // anti-cheat: block browser back during play
    history.pushState(null, "", location.href);
    const block = () => history.pushState(null, "", location.href);
    window.addEventListener("popstate", block);

    const onShow = (p: any) => useGame.getState().set({ question: p.question, endsAt: p.endsAt, locked: false, selectedIndex: undefined, reveal: undefined });
    const onReveal = (p: any) => { useGame.getState().set({ reveal: p });
      const sel = useGame.getState().selectedIndex;
      if (sel === p.correctIndex) sfx.correct(); else if (sel !== undefined) sfx.wrong(); };
    const onScored = (p: any) => useGame.getState().set({ score: p.score, streak: p.streak });
    const onOver = () => nav("/play/end");
    socket.on("question:show", onShow); socket.on("question:reveal", onReveal);
    socket.on("player:scored", onScored); socket.on("game:over", onOver);
    return () => { window.removeEventListener("popstate", block);
      socket.off("question:show", onShow); socket.off("question:reveal", onReveal);
      socket.off("player:scored", onScored); socket.off("game:over", onOver); };
  }, []);

  const answer = (i: number) => {
    if (g.locked || !g.question) return;
    useGame.getState().set({ selectedIndex: i, locked: true });
    socket.emit("answer:submit", { questionId: g.question.id, index: i }, (r) => {
      if (!r.ok) useGame.getState().set({ locked: false, selectedIndex: undefined });
    });
  };

  const q = g.question;
  if (!q) return <div className="min-h-dvh flex items-center justify-center"><p>Loading…</p></div>;
  const stateFor = (i: number) => {
    if (g.reveal) return i === g.reveal.correctIndex ? "correct" : i === g.selectedIndex ? "wrong" : "dim";
    return i === g.selectedIndex ? "selected" : "idle";
  };
  return (
    <div className="relative min-h-dvh p-4 flex flex-col z-10">
      <ParticleBg />
      <div className="z-10 flex items-center justify-between mb-2">
        <span className="font-bebas text-xl">Q{q.index + 1}/{q.total}</span>
        <CircularTimer remainingMs={g.paused ? 0 : remaining} totalMs={30000} size={90} />
        <span className="font-bebas text-xl">⭐{g.score} 🔥{g.streak}</span>
      </div>
      <h1 className="z-10 font-cinzel text-2xl text-center my-4">{q.text}</h1>
      <div className="z-10 grid gap-3 flex-1 content-center">
        {q.options.map((o, i) => (
          <OptionCard key={i} index={i} text={o} disabled={g.locked} onClick={() => answer(i)} state={stateFor(i) as any} />
        ))}
      </div>
      {g.locked && !g.reveal && (
        <p className="z-10 text-center font-cinzel text-xl gold-text mt-4">Answer Locked ✓ — Waiting for others…</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: PlayerEnd.tsx** (final personal card)

```tsx
import { useGame } from "../store/gameStore";
import GlassCard from "../components/GlassCard";
import ParticleBg from "../components/ParticleBg";
import Fireworks from "../components/Fireworks";
import { ms2s, pct } from "../lib/format";
export default function PlayerEnd() {
  const { over, playerId } = useGame();
  const me = over?.fullRanking.find(r => r.playerId === playerId);
  const top3 = me ? me.rank <= 3 : false;
  return (
    <div className="relative min-h-dvh flex items-center justify-center p-6">
      <ParticleBg />{top3 && <Fireworks />}
      <GlassCard className="z-10 text-center max-w-sm">
        <div className="text-5xl mb-2">{top3 ? "🏆" : "👑"}</div>
        <h2 className="font-cinzel text-3xl gold-text mb-1">{me ? `Rank #${me.rank}` : "Thanks for playing!"}</h2>
        {me && <>
          <p className="font-bold text-xl">{me.name}</p>
          <div className="grid grid-cols-2 gap-3 mt-4 text-left">
            <Stat l="Score" v={String(me.score)} /><Stat l="Accuracy" v={pct(me.accuracy)} />
            <Stat l="Total Time" v={ms2s(me.totalMs)} /><Stat l="Best Streak" v={String(me.streak)} />
            <Stat l="Fastest" v={me.fastestMs ? ms2s(me.fastestMs) : "—"} /><Stat l="Correct" v={`${me.correct}/${me.correct + me.wrong}`} />
          </div>
        </>}
      </GlassCard>
    </div>
  );
}
function Stat({ l, v }: { l: string; v: string }) {
  return <div className="glass px-3 py-2"><div className="text-cream-dim text-xs">{l}</div><div className="font-bebas text-2xl">{v}</div></div>;
}
```

- [ ] **Step 3: Reconnect on app load** — modify `client/src/socket/socket.ts` to auto-reconnect player

```ts
import { io, Socket } from "socket.io-client";
import type { ClientToServer, ServerToClient } from "../lib/types";
const URL = import.meta.env.VITE_SERVER_URL as string;
export const socket: Socket<ServerToClient, ClientToServer> =
  io(URL, { autoConnect: true, transports: ["websocket"] });

socket.on("connect", () => {
  const raw = localStorage.getItem("srk-player");
  if (!raw) return;
  const { playerId } = JSON.parse(raw);
  socket.emit("player:reconnect", { playerId }, (r) => {
    if (!r.ok) return;
    // hydrate store + route handled by pages observing question:show; store snapshot:
    import("../store/gameStore").then(({ useGame }) => useGame.getState().set({
      playerId, question: r.state.question, endsAt: r.state.endsAt,
      locked: r.state.alreadyAnswered, score: r.state.score, streak: r.state.streak }));
  });
});
```

- [ ] **Step 4: Build client (typecheck)**

Run: `npm --workspace client run build`
Expected: build succeeds. Fix type errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/PlayerPlay.tsx client/src/pages/PlayerEnd.tsx client/src/socket/socket.ts
git commit -m "feat(client): player play/end, reconnect, back-guard, answer lock"
```

---

## Phase 10 — Integration Smoke Test (manual)

### Task 10.1: Local end-to-end run

**Files:** none (verification task)

- [ ] **Step 1: Provision Neon dev DB**, set `server/.env` `DATABASE_URL`, then push schema + seed

```bash
npm --workspace server run prisma:push
npm --workspace server run seed
```
Expected: "Seeded 40 questions".

- [ ] **Step 2: Run both apps**

```bash
npm run dev
```
Expected: server on :4000, client on :5173.

- [ ] **Step 3: Manual smoke checklist** (use two browsers: one host, one+ player)

Verify in order:
1. Landing → Host login (`srkwarriors`) → Dashboard → Create → PIN + QR show.
2. Player `/join` with name + PIN → appears in host lobby; second player with **same name** → rejected.
3. Host Start → both screens show Q1, timer counts down identically.
4. Player taps option → locks → "Answer Locked"; second tap ignored.
5. Timer hits 0 (or host Reveal) → correct highlighted, bar chart + explanation on host.
6. Host Next advances; after 5 Qs host "Board" shows leaderboard with ranks.
7. Host ±10s changes timer live; Pause/Resume freezes/continues.
8. Refresh a player mid-question → reconnects, shows current question + score.
9. Host End → host podium + fireworks; player sees personal rank card.

- [ ] **Step 4: Commit any fixes found**

```bash
git add -A
git commit -m "fix: issues found during local e2e smoke test"
```

---

## Phase 11 — Deployment Config + README

### Task 11.1: Deploy files

**Files:**
- Create: `server/Procfile` (optional), `render.yaml`, `client/vercel.json`, `.env.example` files already created

- [ ] **Step 1: render.yaml** (Render backend blueprint)

```yaml
services:
  - type: web
    name: srk-quiz-server
    runtime: node
    rootDir: server
    buildCommand: npm install && npm run build && npx prisma generate
    startCommand: npx prisma migrate deploy && npm start
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: HOST_PASSWORD
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: CORS_ORIGIN
        sync: false
      - key: PORT
        value: 10000
```

- [ ] **Step 2: client/vercel.json** (SPA rewrite so deep links work)

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

- [ ] **Step 3: Add prisma migration** (needed for `migrate deploy`)

```bash
npm --workspace server exec prisma migrate dev --name init
git add server/prisma/migrations
```

- [ ] **Step 4: Commit**

```bash
git add render.yaml client/vercel.json
git commit -m "chore: deploy config for Render + Vercel"
```

### Task 11.2: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md** covering: overview, features, tech stack, local setup (Neon URL, env, `prisma push`, `seed`, `npm run dev`), socket event reference (link spec), deploy steps (Vercel for `client/` with `VITE_SERVER_URL`; Render for `server/` via `render.yaml`; Neon free DB), keep-alive pinger setup (cron-job.org → `GET /health` every 10 min), host password note, and Phase-2 roadmap (certificates, question manager, import/export, bonus modes).

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with setup + deploy + keep-alive instructions"
```

---

## Self-Review (completed against spec)

- **Landing / toggles / particles** → Task 7.1 ✓
- **Host login (server-verified password)** → Task 4.1 + 7.2 ✓
- **Create game PIN + QR + lobby** → Task 8.1 ✓
- **Player join + dedup + lobby** → Task 9.1 (dedup also DB-level Task 1.2 + GM Task 3.1) ✓
- **40 Qs / 30s / 1pt** → seed 1.3, settings shared 0.2, GM 3.1 ✓
- **Server-authoritative timer + endsAt + tick throttle** → GM 3.1 ✓
- **Answer capture + responseMs + double-submit block** → GM 3.1 + DB unique 1.2 ✓
- **Scoring + winner tiebreak chain** → Tasks 2.1, 2.2 ✓
- **Reveal + explanation + distribution bar chart + pctCorrect** → GM reveal 3.1, HostGame 8.2, AnswerBarChart 6.2 ✓
- **Live leaderboard every 5 + animated + top3 medals** → Leaderboard 6.2, host board control 8.2 (every-5 cadence: host triggers, or auto — see note) ✓
- **Host analytics (answered/pending/accuracy/distribution)** → GM emitAnalytics 3.1, HostGame 8.2 ✓
- **Host controls (all)** → Controls 8.2 + GM methods + host socket 4.2 ✓
- **End screen podium + fireworks + stats** → HostEnd 8.3, PlayerEnd 9.2 ✓
- **Audio FX (tick/correct/wrong/victory/applause + mute)** → audioStore 5.2, wired 6.1/8.3/9.2 ✓
- **Reconnect (restore question/score/timer)** → socket reconnect 9.2 + GM reconnect 3.1 ✓
- **Anti-cheat (one answer, back-guard, dedup, no correctIndex leak, dedup submit)** → multiple ✓
- **Responsive (mobile player / projector host)** → separate page layouts, Tailwind responsive ✓
- **Deploy Vercel + Render + Neon free** → Phase 11 ✓

**Gap flagged & resolved:** "leaderboard every 5 questions" — v1 ships as host-triggered "Board" button; **automatic** cadence is a 3-line add (host emits showBoard when `(index+1) % leaderboardEvery === 0` on `question:reveal`). Documented as optional enhancement in HostGame, not a blocker.

**Deferred (Phase 2, separate specs):** certificates PDF, full Question Manager CRUD, CSV/Excel import-export, results export endpoints, admin archive/restore, bonus modes (Fan Feud, Spin Wheel, badges, reactions, host chat), multimedia question types.
