const express = require('express');
const router = express.Router();
const controller = require('../controllers/sprint-forecaster.controller');

router.post('/analyze', controller.analyzeSprint);
router.post('/simulate', controller.simulateScenario);

// Issue #619 — Run Monte Carlo with calibration multiplier applied
router.post('/calibrated-simulate', controller.calibratedForecast);

module.exports = router;
