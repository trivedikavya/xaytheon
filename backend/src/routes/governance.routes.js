const express = require('express');
const router = express.Router();
const govController = require('../controllers/governance.controller');
const { verifyAccessToken } = require('../middleware/auth.middleware');

// Public/Auth-optional for demo
router.get('/status', govController.getStatus);
router.post('/propose', govController.proposeSpend);
router.post('/vote', govController.castVote);
router.get('/audit', govController.getAuditTrail);

module.exports = router;
