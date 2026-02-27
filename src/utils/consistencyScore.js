/**
 * Calculates a consistency score from 0-100 based on contribution patterns.
 * Higher scores come from regular activity with fewer long gaps.
 */
function calculateConsistencyScore(contributions) {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const MIN_OBSERVATION_DAYS = 14;
    const MIN_ACTIVITY_DAYS_FOR_FULL_CONFIDENCE = 10;
    const MAX_SPAN_FOR_FULL_SERIES = 365 * 3; // 3-year safety clamp
    const EPSILON = 1e-10;

    if (!contributions || typeof contributions !== "object") return 0;

    // Strict ISO date parsing (YYYY-MM-DD only)
    const parseDate = (dateStr) => {
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;

        const y = Number(match[1]);
        const m = Number(match[2]);
        const d = Number(match[3]);

        const ms = Date.UTC(y, m - 1, d);
        const dt = new Date(ms);

        if (
            dt.getUTCFullYear() !== y ||
            dt.getUTCMonth() !== m - 1 ||
            dt.getUTCDate() !== d
        ) {
            return null;
        }

        return ms;
    };

    const dateEntries = Object.keys(contributions)
        .map(d => ({ raw: d, ms: parseDate(d) }))
        .filter(d => Number.isInteger(d.ms))
        .sort((a, b) => a.ms - b.ms);

    if (dateEntries.length < 2) return 0;

    // Aggregate contributions per distinct date (safety)
    const dailyMap = new Map();
    for (const entry of dateEntries) {
        const value = Number(contributions[entry.raw]);
        const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
        const key = Math.floor(entry.ms); // defensive integer enforcement
        dailyMap.set(key, (dailyMap.get(key) || 0) + safeValue);
    }

    const msDates = Array.from(dailyMap.keys()).sort((a, b) => a - b);
    const activityDays = msDates.length;

    if (activityDays < 2) return 0;

    const firstMs = msDates[0];
    const lastMs = msDates[msDates.length - 1];

    // Inclusive span (calendar-correct)
    const spanDays =
        Math.floor((lastMs - firstMs) / MS_PER_DAY) + 1;

    // ---- Gap Penalty Component ----
    let totalGapWeight = 0;

    for (let i = 1; i < msDates.length; i++) {
        const gapDays = Math.floor(
            (msDates[i] - msDates[i - 1]) / MS_PER_DAY
        );

        // Penalize only excess beyond 7 days
        const excess = Math.max(0, gapDays - 7);

        // Smooth penalty using tanh
        totalGapWeight += Math.tanh(excess / 7);
    }

    const transitions = Math.max(1, activityDays - 1);
    const avgGapPenalty = totalGapWeight / transitions;
    const gapPenalty = Math.tanh(avgGapPenalty) * 25;

    // ---- Frequency Component ----
    let frequencyRatio = activityDays / spanDays;

    const spanConfidence =
        Math.min(spanDays / MIN_OBSERVATION_DAYS, 1);

    const countConfidence =
        Math.min(activityDays / MIN_ACTIVITY_DAYS_FOR_FULL_CONFIDENCE, 1);

    const confidence = spanConfidence * countConfidence;

    frequencyRatio *= confidence;

    const frequencyScore =
        Math.tanh(frequencyRatio * 3) * 50;

    // ---- Stability Component (Variance-based) ----
    let logValues;

    if (spanDays <= MAX_SPAN_FOR_FULL_SERIES) {
        // Build full-span daily series including zero-activity days
        const fullSeries = new Array(spanDays);

        for (let day = 0; day < spanDays; day++) {
            const currentMs = firstMs + day * MS_PER_DAY;
            fullSeries[day] = dailyMap.get(currentMs) || 0;
        }

        logValues = fullSeries.map(v => Math.log1p(v));
    } else {
        // For extremely large spans, compute stability using sparse series
        logValues = msDates.map(ms => Math.log1p(dailyMap.get(ms)));
    }

    const mean =
        logValues.reduce((sum, v) => sum + v, 0) /
        logValues.length;

    const variance =
        logValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
        logValues.length;

    const stdDev = Math.sqrt(variance);

    const cv =
        mean > EPSILON ? stdDev / mean : stdDev;

    const stabilityScore =
        25 - Math.tanh(cv * 2) * 25;

    const finalScore =
        frequencyScore + (25 - gapPenalty) + stabilityScore;

    return Math.max(0, Math.min(100, Math.round(finalScore)));
}
