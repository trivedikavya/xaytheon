/**
 * Predictive Analytics Routes
 * Extended (Issue #616): burnout-risk and rebalance routes
 */

const express = require('express');
const router = express.Router();
const predictiveController = require('../controllers/predictive.controller');

router.get('/velocity', predictiveController.getVelocity.bind(predictiveController));
router.post('/forecast/milestone', predictiveController.forecastMilestone.bind(predictiveController));
router.post('/simulate', predictiveController.simulateScenario.bind(predictiveController));
router.get('/bottlenecks', predictiveController.analyzeBottlenecks.bind(predictiveController));
router.get('/burndown', predictiveController.getBurndown.bind(predictiveController));
router.post('/burnout', predictiveController.detectBurnout.bind(predictiveController));
router.post('/sentiment', predictiveController.analyzeSentiment.bind(predictiveController));
router.get('/health', predictiveController.getProjectHealth.bind(predictiveController));
router.post('/compare', predictiveController.compareHistorical.bind(predictiveController));

// Issue #616 — Burnout Detection & Workload Rebalancing
// Returns per-dev burnout risk scores aggregated from all 4 services
router.post('/burnout-risk', predictiveController.getBurnoutRisk.bind(predictiveController));
// Auto-generates ticket reassignment proposals for at-risk devs
router.post('/rebalance', predictiveController.rebalanceWorkload.bind(predictiveController));

module.exports = router;
