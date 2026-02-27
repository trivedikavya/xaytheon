/**
 * Push Notification Routes
 * Extended (Issue #615): delivery status and failure handling
 */

const express = require('express');
const router = express.Router();
const pushController = require('../controllers/push.controller');
const { verifyAccessToken, optionalAuth } = require('../middleware/auth.middleware');

// Public
router.get('/vapid-public-key', pushController.getVapidPublicKey);

// Auth-optional
router.post('/subscribe', optionalAuth, pushController.subscribe);
router.post('/unsubscribe', pushController.unsubscribe);

// Protected
router.post('/send', verifyAccessToken, pushController.sendNotification);

// Issue #615 — Delivery Status & Failure Handling
router.post('/delivery-status', verifyAccessToken, pushController.updateDeliveryStatus);
router.post('/failure', verifyAccessToken, pushController.handlePushFailure);

module.exports = router;
