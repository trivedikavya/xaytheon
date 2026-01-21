/**
 * Contributor Consistency Score
 * Range: 0–100
 *
 * High score → regular commits
 * Low score → long gaps or one-time bursts
 */
export function calculateConsistencyScore(commitDates) {
  if (!Array.isArray(commitDates) || commitDates.length === 0) return 0;

  const dates = commitDates
    .map(d => new Date(d).getTime())
    .sort((a, b) => a - b);

  const gaps = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
  }

  const avgGap = gaps.length
    ? gaps.reduce((a, b) => a + b, 0) / gaps.length
    : 0;

  const frequencyScore = Math.max(0, 1 - avgGap / 14);

  const activeDays = new Set(
    dates.map(d => new Date(d).toDateString())
  ).size;

  const burstPenalty =
    commitDates.length > 15 && activeDays < 4 ? 0.6 : 1;

  return Math.round(Math.min(100, frequencyScore * burstPenalty * 100));
}
