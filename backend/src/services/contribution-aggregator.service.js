
const consistencyScore = calculateConsistencyScore(contributions);
const cacheService = require('./cache.service');

class ContributionAggregatorService {
    constructor() {
        this.cacheTTL = 60 * 60; // 1 hour (adjust as needed)
    }

    /* =====================================================
       CONTRIBUTION DATA (MOCKED)
    ===================================================== */
    async getContributionData(username) {
        const cacheKey = `github:contributions:${username}`;

        return cacheService.getOrSet(
            cacheKey,
            async () => {
                // Simulate API latency
                await new Promise(res => setTimeout(res, 300));

                const today = new Date();
                const startDate = new Date(today);
                startDate.setDate(today.getDate() - 364);

                const contributions = {};
                let total = 0;
                let maxStreak = 0;
                let currentStreak = 0;
                let runningStreak = 0;

                for (let i = 0; i <= 364; i++) {
                    const d = new Date(startDate);
                    d.setDate(startDate.getDate() + i);

                    const dateStr = d.toISOString().split('T')[0];
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const activityChance = isWeekend ? 0.3 : 0.7;

                    let count = 0;
                    if (Math.random() < activityChance) {
                        count = Math.floor(Math.random() * 12);
                        if (Math.random() > 0.9) count += 10;
                    }

                    if (count > 0) {
                        contributions[dateStr] = count;
                        total += count;
                        runningStreak++;
                        maxStreak = Math.max(maxStreak, runningStreak);
                    } else {
                        runningStreak = 0;
                    }
                }

                // Current streak only valid if today has activity
                const todayKey = today.toISOString().split('T')[0];
                currentStreak = contributions[todayKey] ? runningStreak : 0;

                return {
                    contributions,
                    stats: {
                        total,
                        currentStreak,
                        consistencyScore,
                        maxStreak,
                        startDate: startDate.toISOString().split('T')[0],
                        endDate: todayKey
                    }
                };
            },
            this.cacheTTL
        );
    }

    /* =====================================================
       INSIGHTS
    ===================================================== */
    calculateInsights({ contributions = {} }) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayTotals = new Array(7).fill(0);
        const hourTotals = new Array(24).fill(0);

        Object.entries(contributions).forEach(([dateStr, count]) => {
            const date = new Date(dateStr);
            dayTotals[date.getDay()] += count;

            for (let i = 0; i < count; i++) {
                const r = Math.random();
                let hour;

                if (r < 0.7) hour = 9 + Math.floor(Math.random() * 9);       // 9–17
                else if (r < 0.9) hour = 18 + Math.floor(Math.random() * 5); // 18–22
                else hour = Math.floor(Math.random() * 24);

                hourTotals[hour]++;
            }
        });

        const bestDayIndex = dayTotals.indexOf(Math.max(...dayTotals));
        const bestHourIndex = hourTotals.indexOf(Math.max(...hourTotals));

        const intensityDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
        Object.values(contributions).forEach(count => {
            if (count === 0) intensityDistribution[0]++;
            else if (count <= 3) intensityDistribution[1]++;
            else if (count <= 6) intensityDistribution[2]++;
            else if (count <= 9) intensityDistribution[3]++;
            else intensityDistribution[4]++;
        });

        return {
            bestDay: {
                name: days[bestDayIndex],
                count: dayTotals[bestDayIndex]
            },
            mostProductiveHour: {
                hour: bestHourIndex,
                count: hourTotals[bestHourIndex]
            },
            dayDistribution: dayTotals,
            hourDistribution: hourTotals,
            intensityDistribution
        };
    }
    /**
     * Context-Switch Cost Model (Issue #619)
     * Estimates productivity loss based on how many parallel tasks a contributor
     * has been active on over the given window (days).
     * @param {string} username
     * @param {Object} contributions - date -> count map
     * @param {number} windowDays
     */
    computeContextSwitchCost(username, contributions = {}, windowDays = 14) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - windowDays);

        const activeDays = Object.entries(contributions)
            .filter(([date]) => new Date(date) >= cutoff)
            .filter(([, count]) => count > 0);

        const totalActiveDays = activeDays.length;

        // Spike detection: days with unusually high commits (>8) suggest crunch/context-switching
        const spikeDays = activeDays.filter(([, count]) => count > 8).length;
        const spikeFraction = totalActiveDays > 0 ? spikeDays / totalActiveDays : 0;

        // Cost score: 0 (no cost) to 1 (maximum penalty)
        const contextSwitchCost = Math.min(1, spikeFraction * 1.5);

        // Effective velocity multiplier: 1.0 = no penalty, 0.7 = severe penalty
        const velocityMultiplier = parseFloat(Math.max(0.7, 1 - contextSwitchCost * 0.3).toFixed(3));

        return {
            username,
            windowDays,
            totalActiveDays,
            spikeDays,
            spikeFraction: parseFloat(spikeFraction.toFixed(3)),
            contextSwitchCost: parseFloat(contextSwitchCost.toFixed(3)),
            velocityMultiplier,
            status: contextSwitchCost > 0.5 ? 'HIGH_SWITCHING' : contextSwitchCost > 0.2 ? 'MODERATE' : 'FOCUSED'
        };
    }

    /**
     * Focus-Depth Scoring (Issue #619)
     * Measures how "deep" a contributor's work sessions are.
     * Deep work = several consecutive days of moderate commits (3-8/day).
     * Shallow work = many 1-2 commit days scattered throughout.
     * @param {Object} contributions - date -> count map
     * @returns {Object} focusScore (0-100), depth classification
     */
    computeFocusDepthScore(contributions = {}) {
        const counts = Object.values(contributions);
        if (counts.length === 0) return { focusScore: 0, depth: 'UNKNOWN' };

        const deepSessions = counts.filter(c => c >= 3 && c <= 8).length;
        const shallowSessions = counts.filter(c => c > 0 && c < 3).length;
        const totalActive = counts.filter(c => c > 0).length;

        const focusScore = totalActive > 0
            ? Math.round((deepSessions / totalActive) * 100)
            : 0;

        let depth = 'SHALLOW';
        if (focusScore >= 60) depth = 'DEEP';
        else if (focusScore >= 35) depth = 'MODERATE';

        return {
            focusScore,
            depth,
            deepSessions,
            shallowSessions,
            totalActiveDays: totalActive
        };
    }

    /**
     * Rolling 14-day load metrics and spike detection (Issue #619)
     * @param {Object} contributions - date -> count map
     */
    getRollingLoadMetrics(contributions = {}) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 14);

        const recentEntries = Object.entries(contributions)
            .filter(([date]) => new Date(date) >= cutoff);

        const counts = recentEntries.map(([, c]) => c);
        const total = counts.reduce((a, b) => a + b, 0);
        const avg = counts.length > 0 ? total / counts.length : 0;
        const max = counts.length > 0 ? Math.max(...counts) : 0;

        const spikeDays = counts.filter(c => c > avg * 2).length;

        return {
            windowDays: 14,
            totalCommits: total,
            avgDailyCommits: parseFloat(avg.toFixed(2)),
            maxDailyCommits: max,
            spikeDays,
            loadLevel: avg > 8 ? 'OVERLOADED' : avg > 4 ? 'OPTIMAL' : 'UNDERLOADED'
        };
    }
}

module.exports = new ContributionAggregatorService();
