const skillService = require('../services/skill-matrix.service');
const optimizerService = require('../services/sprint-optimizer.service');
const forecasterService = require('../services/sprint-forecaster.service');

// ─── Existing Endpoints ──────────────────────────────────────────────────────

exports.getSprintPlans = async (req, res) => {
    try {
        const { tasks } = req.body;
        const team = await skillService.getTeamSkills();

        const backlog = tasks || [
            { id: 101, name: 'Setup DB Schema', type: 'node', points: 5 },
            { id: 102, name: 'Create React Components', type: 'react', points: 8 },
            { id: 103, name: 'AI Model Training', type: 'python', points: 13 },
            { id: 104, name: 'CI/CD Pipeline', type: 'devops', points: 5 },
            { id: 105, name: 'API Authentication', type: 'node', points: 3 },
            { id: 106, name: 'Data Visualization', type: 'react', points: 8 }
        ];

        const plans = await optimizerService.generateSprintPlans(backlog, team);

        res.json({ success: true, data: { team, plans } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.recalculatePlan = async (req, res) => {
    try {
        const { assignments } = req.body;
        const team = await skillService.getTeamSkills();
        const evaluation = await optimizerService.evaluatePlan(assignments, team);
        res.json({ success: true, data: evaluation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Issue #619 — Adaptive Velocity Calibrator ──────────────────────────────

/**
 * POST /api/sprint/calibrate
 * Record a sprint retrospective outcome for a contributor.
 * Body: { devId: "alice", estimated: 20, actual: 17 }
 */
exports.calibrate = (req, res) => {
    try {
        const { devId, estimated, actual } = req.body;
        if (!devId || estimated == null || actual == null) {
            return res.status(400).json({ success: false, message: 'devId, estimated, and actual are required.' });
        }
        const result = optimizerService.recordSprintOutcome(devId, estimated, actual);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/sprint/calibration-report
 * Returns calibration multipliers for all tracked contributors.
 */
exports.getCalibrationReport = (req, res) => {
    try {
        const report = optimizerService.getCalibrationReport();
        res.json({ success: true, data: report });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/sprint/register-pto
 * Register PTO fraction for a contributor.
 * Body: { devId: "bob", ptoDays: 3, sprintDays: 10 }
 */
exports.registerPTO = (req, res) => {
    try {
        const { devId, ptoDays, sprintDays } = req.body;
        if (!devId || ptoDays == null) {
            return res.status(400).json({ success: false, message: 'devId and ptoDays are required.' });
        }
        optimizerService.registerPTO(devId, ptoDays, sprintDays || 10);
        res.json({ success: true, message: `PTO registered for ${devId}: ${ptoDays} day(s).` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/sprint/capacity-report
 * Per-contributor normalized capacity adjusted for calibration, PTO, and context-switch cost.
 */
exports.getCapacityReport = async (req, res) => {
    try {
        const team = await skillService.getTeamSkills();
        const report = optimizerService.getCapacityReport(team);
        res.json({ success: true, data: report });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/sprint/retrospective
 * Full retrospective view: volatility metrics, contributor bias, fatigue index, rolling error.
 */
exports.getRetrospective = async (req, res) => {
    try {
        const [volatility, bias, fatigue] = await Promise.all([
            forecasterService.getVolatilityMetrics(),
            Promise.resolve(forecasterService.getContributorEstimationBias()),
            forecasterService.getFatigueIndex()
        ]);

        const rollingErrorRate = forecasterService.getRollingErrorRate(3);

        res.json({
            success: true,
            data: {
                sprintHistory: volatility,
                contributorBias: bias,
                fatigueIndex: fatigue,
                rollingEstimationErrorRate: rollingErrorRate
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/sprint/record-retro
 * Record a sprint's retrospective data for future accuracy tracking.
 * Body: { sprint: "Sprint 16", estimated: 45, actual: 43, contributors: { ... } }
 */
exports.recordRetroData = (req, res) => {
    try {
        const retroEntry = req.body;
        if (!retroEntry.sprint || retroEntry.estimated == null || retroEntry.actual == null) {
            return res.status(400).json({ success: false, message: 'sprint, estimated, and actual are required.' });
        }
        forecasterService.recordRetroData(retroEntry);
        res.json({ success: true, message: `Retrospective data recorded for ${retroEntry.sprint}.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
