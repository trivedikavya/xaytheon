const forecasterService = require('../services/sprint-forecaster.service');

exports.analyzeSprint = async (req, res) => {
    try {
        const { backlogPoints, teamVelocity, historicalVolatility, daysRemaining } = req.body;

        const simulation = await forecasterService.runMonteCarlo({
            backlogPoints: backlogPoints || 50,
            teamVelocity: teamVelocity || 8,
            historicalVolatility: historicalVolatility || 0.15,
            daysRemaining: daysRemaining || 5
        });

        const volatility = await forecasterService.getVolatilityMetrics();
        const fatigue = await forecasterService.getFatigueIndex();

        res.json({
            success: true,
            data: {
                simulation,
                volatility,
                fatigue
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.simulateScenario = async (req, res) => {
    try {
        const { adjustments } = req.body;
        const baseData = {
            backlogPoints: 50 + (adjustments.addedFeatures || 0),
            teamVelocity: 8 + (adjustments.velocityChange || 0),
            historicalVolatility: 0.15,
            daysRemaining: 5
        };

        const simulation = await forecasterService.runMonteCarlo(baseData);

        res.json({ success: true, data: simulation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/sprint-forecaster/calibrated-simulate
 * Runs Monte Carlo with calibrated velocity applied.
 * Body: { backlogPoints, teamVelocity, historicalVolatility, daysRemaining, calibratedMultiplier }
 */
exports.calibratedForecast = async (req, res) => {
    try {
        const {
            backlogPoints = 50,
            teamVelocity = 8,
            historicalVolatility = 0.15,
            daysRemaining = 5,
            calibratedMultiplier = 1.0
        } = req.body;

        const simulation = await forecasterService.runMonteCarlo(
            { backlogPoints, teamVelocity, historicalVolatility, daysRemaining },
            { calibratedMultiplier }
        );

        const bias = forecasterService.getContributorEstimationBias();
        const rollingError = forecasterService.getRollingErrorRate(3);

        res.json({
            success: true,
            data: {
                simulation,
                calibratedMultiplierApplied: calibratedMultiplier,
                contributorBias: bias,
                rollingEstimationErrorRate: rollingError
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
