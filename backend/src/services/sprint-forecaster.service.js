/**
 * Sprint Forecaster Service
 * Handles Monte Carlo simulations, volatility tracking, and team fatigue analysis.
 * 
 * Extended: Retrospective Accuracy Tracker & Rolling Estimation-Error Rate (Issue #619)
 * - Tracks actual vs estimated per sprint with error rate computation
 * - Feeds calibrated velocity into Monte Carlo
 * - Computes per-contributor estimation bias (over/under)
 */
class SprintForecasterService {

    constructor() {
        // In-memory sprint history with actuals
        this.sprintHistory = [
            { sprint: 'Sprint 12', estimated: 40, actual: 38, contributors: { alice: { est: 15, act: 14 }, bob: { est: 25, act: 24 } } },
            { sprint: 'Sprint 13', estimated: 45, actual: 42, contributors: { alice: { est: 20, act: 18 }, bob: { est: 25, act: 24 } } },
            { sprint: 'Sprint 14', estimated: 50, actual: 35, contributors: { alice: { est: 22, act: 14 }, bob: { est: 28, act: 21 } } },
            { sprint: 'Sprint 15', estimated: 42, actual: 44, contributors: { alice: { est: 18, act: 20 }, bob: { est: 24, act: 24 } } }
        ];
    }

    /**
     * Runs a Monte Carlo simulation, optionally using calibrated velocity.
     * @param {Object} sprintData
     * @param {Object} calibrationContext - optional { calibratedMultiplier: 0.9 }
     */
    async runMonteCarlo(sprintData, calibrationContext = {}) {
        let { backlogPoints, teamVelocity, historicalVolatility, daysRemaining } = sprintData;
        const iterations = 10000;
        let successCount = 0;
        const outcomes = [];

        // Apply calibration multiplier if provided
        if (calibrationContext.calibratedMultiplier) {
            teamVelocity = teamVelocity * calibrationContext.calibratedMultiplier;
        }

        for (let i = 0; i < iterations; i++) {
            const randomVolatility = 1 + (Math.random() * historicalVolatility * 2 - historicalVolatility);
            const simulatedVelocity = teamVelocity * randomVolatility;
            const completedPoints = simulatedVelocity * daysRemaining;

            if (completedPoints >= backlogPoints) successCount++;
            outcomes.push(completedPoints);
        }

        const confidenceLevel = (successCount / iterations) * 100;

        return {
            confidenceLevel: parseFloat(confidenceLevel.toFixed(2)),
            iterations,
            calibratedVelocityUsed: parseFloat(teamVelocity.toFixed(2)),
            averageOutcome: outcomes.reduce((a, b) => a + b, 0) / iterations,
            p50: this.getPercentile(outcomes, 50),
            p90: this.getPercentile(outcomes, 90)
        };
    }

    /**
     * Analyzes historical volatility (Estimated vs. Actual points).
     * Now includes estimation error rate per sprint.
     */
    async getVolatilityMetrics() {
        return this.sprintHistory.map(s => ({
            sprint: s.sprint,
            estimated: s.estimated,
            actual: s.actual,
            volatility: parseFloat((Math.abs(s.estimated - s.actual) / s.estimated).toFixed(3)),
            errorRate: parseFloat(((s.actual - s.estimated) / s.estimated * 100).toFixed(1)),
            overDelivered: s.actual > s.estimated
        }));
    }

    /**
     * Computes rolling estimation error rate over N sprints.
     */
    getRollingErrorRate(n = 3) {
        const recent = this.sprintHistory.slice(-n);
        if (recent.length === 0) return 0;
        const errors = recent.map(s => Math.abs(s.estimated - s.actual) / s.estimated);
        return parseFloat((errors.reduce((a, b) => a + b, 0) / errors.length * 100).toFixed(2));
    }

    /**
     * Per-contributor retrospective: bias direction and magnitude.
     */
    getContributorEstimationBias() {
        const biasByContributor = {};

        this.sprintHistory.forEach(sprint => {
            if (!sprint.contributors) return;
            Object.entries(sprint.contributors).forEach(([name, data]) => {
                if (!biasByContributor[name]) {
                    biasByContributor[name] = { sprintCount: 0, totalError: 0, overEstimations: 0, underEstimations: 0 };
                }
                const error = data.act - data.est;
                biasByContributor[name].sprintCount++;
                biasByContributor[name].totalError += error;
                if (error < 0) biasByContributor[name].overEstimations++;
                else if (error > 0) biasByContributor[name].underEstimations++;
            });
        });

        return Object.entries(biasByContributor).map(([name, stats]) => ({
            name,
            avgBias: parseFloat((stats.totalError / stats.sprintCount).toFixed(2)),
            biasDirection: stats.totalError < 0 ? 'OVER_ESTIMATES' : stats.totalError > 0 ? 'UNDER_ESTIMATES' : 'ACCURATE',
            sprintsCounted: stats.sprintCount,
            overEstimations: stats.overEstimations,
            underEstimations: stats.underEstimations
        }));
    }

    /**
     * Record a new sprint's retrospective data.
     */
    recordRetroData(retroEntry) {
        this.sprintHistory.push(retroEntry);
        if (this.sprintHistory.length > 10) this.sprintHistory.shift();
    }

    /**
     * Calculates the "Project Fatigue Index" (0-100).
     */
    async getFatigueIndex() {
        const historicalSprints = await this.getVolatilityMetrics();
        const velocityTrend = historicalSprints.map(s => s.actual);

        let fatigue = 25;
        if (velocityTrend[2] < velocityTrend[1]) fatigue += 20;
        if (velocityTrend[3] < velocityTrend[2]) fatigue += 30;

        return {
            index: Math.min(100, fatigue),
            status: fatigue > 70 ? 'CRITICAL' : fatigue > 40 ? 'WARNING' : 'HEALTHY',
            recommendation: fatigue > 70 ? 'Immediate cooldown suggested.' : 'Keep monitoring.'
        };
    }

    getPercentile(arr, p) {
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.floor((p / 100) * (sorted.length - 1));
        return sorted[index];
    }
}

module.exports = new SprintForecasterService();
