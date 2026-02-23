const express = require('express');
const router = express.Router();
const controller = require('../controllers/sprint.controller');

// ─── Existing routes ─────────────────────────────────────────────────────────
router.post('/optimize', controller.getSprintPlans);
router.post('/recalculate', controller.recalculatePlan);

// ─── Issue #619 — Adaptive Velocity Calibrator ───────────────────────────────
// Record a sprint retrospective outcome to update a contributor's calibration multiplier
router.post('/calibrate', controller.calibrate);

// Register PTO days for a contributor before sprint planning
router.post('/register-pto', controller.registerPTO);

// Full calibration multiplier report for all tracked contributors
router.get('/calibration-report', controller.getCalibrationReport);

// Capacity report: per-contributor normalized velocity (PTO + calibration + context-switch)
router.get('/capacity-report', controller.getCapacityReport);

// Full retrospective report: sprint history, contributor bias, fatigue, rolling error
router.get('/retrospective', controller.getRetrospective);

// Record a new sprint's actuals into the retrospective history
router.post('/record-retro', controller.recordRetroData);

module.exports = router;
