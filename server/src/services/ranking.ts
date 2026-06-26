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
