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
