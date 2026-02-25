/**
 * Calculates a consistency score from 0-100 based on contribution patterns.
 * Higher scores come from regular activity with fewer long gaps.
 */
function calculateConsistencyScore(contributions) {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const MIN_OBSERVATION_DAYS = 14;

    // Strict ISO date parsing (YYYY-MM-DD only)
    const parseDate = (dateStr) => {
        const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!isoRegex.test(dateStr)) return null;
        const date = new Date(dateStr + "T00:00:00Z");
        return isNaN(date.getTime()) ? null : date;
    };

    const dateEntries = Object.keys(contributions)
        .map(d => ({ raw: d, parsed: parseDate(d) }))
        .filter(d => d.parsed !== null)
        .sort((a, b) => a.parsed - b.parsed);

    if (dateEntries.length < 2) return 0;

    const dates = dateEntries.map(d => d.parsed);
    const values = dateEntries.map(d => contributions[d.raw]);
    const activityDays = dates.length;

    let totalGaps = 0;

    for (let i = 1; i < dates.length; i++) {
        const gapDays = Math.ceil(Math.abs(dates[i] - dates[i - 1]) / MS_PER_DAY);

        // Penalize only excess beyond 7 days
        if (gapDays > 7) totalGaps += (gapDays - 7);
    }

    const span = Math.max(
        1,
        Math.ceil(Math.abs(dates[dates.length - 1] - dates[0]) / MS_PER_DAY)
    );

    // ---- Frequency Component ----
    let frequencyScore = (activityDays / span) * 50;

    // Normalize short observation windows
    if (span < MIN_OBSERVATION_DAYS) {
        frequencyScore *= (span / MIN_OBSERVATION_DAYS);
    }

    frequencyScore = Math.min(50, frequencyScore);

    // ---- Gap Penalty Component ----
    const gapPenalty = Math.min(25, (totalGaps / span) * 25);

    // ---- Stability Component (Variance-based) ----
    const mean =
        values.reduce((sum, v) => sum + v, 0) / activityDays;

    const variance =
        values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
        activityDays;

    const normalizedVariance = mean > 0 ? variance / mean : variance;

    const stabilityScore = Math.max(
        0,
        25 - Math.min(25, normalizedVariance)
    );

    const finalScore =
        frequencyScore + (25 - gapPenalty) + stabilityScore;

    return Math.max(0, Math.min(100, Math.round(finalScore)));
}
