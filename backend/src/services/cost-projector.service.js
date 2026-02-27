/**
 * XAYTHEON — Cost Projector Service
 * Calculates monthly burn rates and projects savings from optimizations.
 */

const resourceSvc = require('./resource-optimization.service');

class CostProjectorService {
    /**
     * Get Current Burn Rate
     */
    getMonthlyBurn() {
        const total = resourceSvc.nodes.reduce((sum, n) => sum + n.cost, 0);
        return {
            totalMonthly: total,
            dailyAverage: total / 30,
            projectedYearly: total * 12
        };
    }

    /**
     * Project Savings
     */
    calculateProjectedSavings() {
        const recommendations = resourceSvc.getRecommendations();
        const totalSavings = recommendations.reduce((sum, r) => sum + r.potentialSavings, 0);

        return {
            estimatedMonthlySavings: totalSavings,
            newProjectedBurn: this.getMonthlyBurn().totalMonthly - totalSavings,
            efficiencyGainPercentage: (totalSavings / this.getMonthlyBurn().totalMonthly) * 100
        };
    }

    /**
     * Get Cost Breakdown by Status
     */
    getBreakdown() {
        const breakdown = { wasteful: 0, optimized: 0, bottleneck: 0, underutilized: 0 };
        resourceSvc.nodes.forEach(n => {
            breakdown[n.status] += n.cost;
        });
        return breakdown;
    }
}

module.exports = new CostProjectorService();
