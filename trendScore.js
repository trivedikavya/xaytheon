/**
 * Repository Trend Scoring Algorithm
 *
 * trendScore =
 * 0.40 * starMomentum +
 * 0.20 * forks30d +
 * 0.25 * activityScore +
 * 0.15 * popularityScore
 *
 * All sub-scores are normalized.
 * This avoids bias toward older repositories.
 */
function starMomentum(stars7d, stars30d) {
  return (stars7d * 1.5 + stars30d) / 100;
}

function forkScore(forks30d) {
  return Math.log1p(forks30d);
}

function activityScore(lastCommitDate) {
  const daysAgo =
    (Date.now() - new Date(lastCommitDate).getTime()) /
    (1000 * 60 * 60 * 24);

  return Math.exp(-daysAgo / 30);
}

function popularityScore(totalStars) {
  return Math.log1p(totalStars) / 10;
}
export function calculateTrendScore(repo) {
  const starScore = starMomentum(repo.stars7d, repo.stars30d);
  const forks = forkScore(repo.forks30d);
  const activity = activityScore(repo.lastCommit);
  const popularity = popularityScore(repo.totalStars);

  return (
    0.4 * starScore +
    0.2 * forks +
    0.25 * activity +
    0.15 * popularity
  );
}
