// Fisher-Yates shuffle (returns a new array).
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Questions in this category are "fan feud" — opinion/poll-style with no
// Google-able or AI-derivable answer. They are the anti-cheat backbone.
export const FAN_FEUD_CATEGORY = "Fan Feud";
const isFeud = (c: string) => c.trim().toLowerCase() === FAN_FEUD_CATEGORY.toLowerCase();

type Diff = "EASY" | "MED" | "HARD";

// Shuffle a question's answer options and remap correctIndex to match, so each
// attempt can present options in a different order without breaking scoring.
export function shuffleOptions<T extends { options: string[]; correctIndex: number }>(q: T): T {
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, options: order.map(i => q.options[i]), correctIndex: order.indexOf(q.correctIndex) };
}

// Pick `total` questions for one attempt with two guarantees:
//  1. between `feudMin` and `feudMax` fan-feud questions (random each time), and
//  2. an overall difficulty mix of ~30% EASY / 40% MED / 30% HARD across the whole
//     quiz (fan-feud questions count toward that mix, using their own difficulty).
// Everything is shuffled so feud questions aren't clustered. Degrades gracefully:
// if a tier or the feud pool is short, it fills from whatever remains, never
// exceeding `total` and never duplicating.
export function pickBalanced<T extends { category: string; difficulty: Diff; options: string[]; correctIndex: number }>(
  pool: T[], total: number, feudMin = 2, feudMax = 3,
): T[] {
  const feud = shuffle(pool.filter(q => isFeud(q.category)));
  const factual = pool.filter(q => !isFeud(q.category));

  const want = feudMin + Math.floor(Math.random() * (feudMax - feudMin + 1));
  const picked: T[] = feud.slice(0, Math.min(want, feud.length, total));

  // Difficulty targets for the whole quiz, then deduct what the feud picks cover.
  const target: Record<Diff, number> = {
    EASY: Math.round(total * 0.3),
    MED: Math.round(total * 0.4),
    HARD: 0,
  };
  target.HARD = Math.max(0, total - target.EASY - target.MED);
  for (const q of picked) if (target[q.difficulty] > 0) target[q.difficulty]--;

  const byDiff: Record<Diff, T[]> = {
    EASY: shuffle(factual.filter(q => q.difficulty === "EASY")),
    MED: shuffle(factual.filter(q => q.difficulty === "MED")),
    HARD: shuffle(factual.filter(q => q.difficulty === "HARD")),
  };
  const result: T[] = [...picked];
  const take = (d: Diff, n: number) => {
    for (let i = 0; i < n && byDiff[d].length && result.length < total; i++) result.push(byDiff[d].pop()!);
  };
  take("EASY", target.EASY);
  take("MED", target.MED);
  take("HARD", target.HARD);

  // Fill any shortfall (a tier ran dry, or rounding) from the leftover factual pool.
  if (result.length < total) {
    for (const q of shuffle([...byDiff.EASY, ...byDiff.MED, ...byDiff.HARD])) {
      if (result.length >= total) break;
      result.push(q);
    }
  }
  // Shuffle question order AND each question's answer options (per attempt).
  return shuffle(result).map(shuffleOptions);
}
