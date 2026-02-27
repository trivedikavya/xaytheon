const express = require('express');
const router = express.Router();
const trafficController = require('../controllers/traffic.controller');
const { verifyAccessToken } = require('../middleware/auth.middleware');

router.get('/mesh', trafficController.getMeshStatus);
router.post('/reroute', trafficController.triggerReroute);
router.get('/blast-radius/:id', trafficController.getBlastRadius);
router.post('/simulate', trafficController.simulateFailure);

module.exports = router;
