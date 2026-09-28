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

// Pick `total` questions for one attempt, GUARANTEEING between `min` and `max`
// fan-feud questions (chosen at random each time), with the remainder filled from
// the factual pool. Everything is shuffled so feud questions aren't clustered.
// Degrades gracefully: if fewer feud/factual questions exist than requested, it
// returns as many as it can (never more than `total`, never duplicates).
export function pickWithFeud<T extends { category: string }>(
  pool: T[], total: number, min = 2, max = 3,
): T[] {
  const feud = pool.filter(q => isFeud(q.category));
  const factual = pool.filter(q => !isFeud(q.category));
  const want = min + Math.floor(Math.random() * (max - min + 1)); // min..max inclusive
  const feudCount = Math.min(want, feud.length, total);
  const picked = shuffle(feud).slice(0, feudCount);
  const fill = shuffle(factual).slice(0, Math.max(0, total - picked.length));
  return shuffle([...picked, ...fill]);
}
