const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/notification.controller");
const { verifyAccessToken } = require("../middleware/auth.middleware");

router.use(verifyAccessToken);

// Existing
router.get("/", ctrl.getNotifications);
router.put("/:id/read", ctrl.markAsRead);
router.put("/read-all", ctrl.markAllAsRead);
router.get("/preferences", ctrl.getPreferences);
router.put("/preferences", ctrl.updatePreferences);

// Issue #615 — Unified Notification Engine
router.get("/digest", ctrl.getDigest);           // flush user digest window
router.post("/retry", ctrl.retryFailed);         // drain & re-emit failed deliveries
router.get("/receipts", ctrl.getReceipts);         // delivery receipt history
router.post("/receipts/:token/ack", ctrl.ackReceipt);       // client ACK a receipt
router.get("/pipeline-stats", ctrl.getPipelineStats);    // admin debug stats

module.exports = router;
