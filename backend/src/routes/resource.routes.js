const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resource.controller');

router.get('/efficiency', resourceController.getEfficiencyReport);
router.get('/recommendations', resourceController.getRecommendations);
router.post('/optimize', resourceController.applyOptimization);

module.exports = router;
