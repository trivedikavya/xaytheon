const express = require('express');
const router = express.Router();
const analyzerController = require('../controllers/analyzer.controller');

// Existing routes
router.get('/analyze', analyzerController.analyzeRepo);
router.get('/recommendations', analyzerController.getRecommendations);

// Issue #617 — CQAS: Code Quality Aggregate Score
// Compute CQAS for a repo/branch/commit (records to history)
router.post('/cqas', analyzerController.getCQAS);

// Return historical CQAS snapshots per branch
router.get('/cqas/history', analyzerController.getCQASHistory);

// CI gate: returns 424 on failure so CI pipelines can detect quality regressions
router.post('/cqas/ci-gate', analyzerController.evaluateCIGate);

module.exports = router;
