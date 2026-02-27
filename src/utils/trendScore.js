const MS_PER_DAY = 86400000;
const EPSILON = 1e-10;

function isoToUtcMidnightMs(iso) {
  if (typeof iso !== "string") return null;

  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
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
}

function computeTrendScore(data, options = {}) {
  if (!data || typeof data !== "object") return 50;

  const {
    MAX_IMPACT = 25,
    TANH_SENSITIVITY = 3,
    SPAN_SATURATION_DAYS = 7,
    COUNT_SATURATION = 10,
    CONFIDENCE_MODE = "multiply",
    NEGATIVE_POLICY = "clamp",
    NORMALIZATION_FLOOR = null,
    ROUND_SCORE = false
  } = options;

  const aggregation = new Map();

  for (const key of Object.keys(data)) {
    const time = isoToUtcMidnightMs(key);
    if (time === null) continue;

    let value = Number(data[key]);
    if (!Number.isFinite(value)) continue;

    if (value < 0) {
      if (NEGATIVE_POLICY === "ignore") continue;
      if (NEGATIVE_POLICY === "clamp") value = 0;
    }

    aggregation.set(time, (aggregation.get(time) || 0) + value);
  }

  if (aggregation.size < 2) return 50;

  const entries = [...aggregation.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({
      time,
      logValue: Math.log1p(value)
    }));

  const n = entries.length;

  const firstVal = entries[0].logValue;
  const isConstant = entries.every(
    e => Math.abs(e.logValue - firstVal) < EPSILON
  );
  if (isConstant) return 50;

  const firstTime = entries[0].time;
  const lastTime = entries[n - 1].time;

  const spanMs = Math.max(lastTime - firstTime, MS_PER_DAY / 100);
  const spanDays = Math.max(1, Math.ceil(spanMs / MS_PER_DAY));

  // Time normalized to [0,1] over calendar span
  const x = new Array(n);
  const y = new Array(n);

  for (let i = 0; i < n; i++) {
    x[i] = (entries[i].time - firstTime) / spanMs;
    y[i] = entries[i].logValue;
  }

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  // OLS regression for log-growth per span
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    numerator += dx * (y[i] - meanY);
    denominator += dx * dx;
  }

  if (Math.abs(denominator) < EPSILON) return 50;

  const slope = numerator / denominator;

  // Normalize relative to average activity level
  const linearMean = Math.expm1(meanY);

  const derivedFloor =
    NORMALIZATION_FLOOR !== null
      ? NORMALIZATION_FLOOR
      : Math.max(0.1, linearMean * 0.01);

  const normDenom = Math.max(linearMean, derivedFloor);

  const normalizedSlope = slope / normDenom;

  const spanConfidence = Math.min(spanDays / SPAN_SATURATION_DAYS, 1);
  const countConfidence = Math.min(n / COUNT_SATURATION, 1);

  const confidence =
    CONFIDENCE_MODE === "max"
      ? Math.max(spanConfidence, countConfidence)
      : spanConfidence * countConfidence;

  const adjustedSlope = normalizedSlope * confidence;

  const impact =
    Math.tanh(adjustedSlope * TANH_SENSITIVITY) * MAX_IMPACT;

  let score = 50 + impact;

  score = Math.max(0, Math.min(100, score));

  return ROUND_SCORE ? Math.round(score) : score;
}

module.exports = { computeTrendScore };
