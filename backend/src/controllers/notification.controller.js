const notificationModel = require("../models/notification.model");
const eventStream = require('../services/event-stream.service');
const EventAggregator = require('../services/event-aggregator');

// Singleton aggregator used for receipt/retry tracking (without geospatial dependency)
class LightAggregator extends EventAggregator {
    constructor() { super({ processGitHubEvent: async () => { } }); }
}
const deliveryEngine = new LightAggregator();

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.userId;
        const { limit = 50, unreadOnly = false } = req.query;
        const notifications = await notificationModel.getUserNotifications(userId, parseInt(limit), unreadOnly === 'true');
        const unreadCount = await notificationModel.getUnreadCount(userId);
        res.json({ success: true, notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        await notificationModel.markAsRead(req.params.id, req.userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        await notificationModel.markAllAsRead(req.userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPreferences = async (req, res) => {
    try {
        let prefs = await notificationModel.getPreferences(req.userId);
        if (!prefs) {
            await notificationModel.upsertPreferences(req.userId, {});
            prefs = await notificationModel.getPreferences(req.userId);
        }
        res.json({ success: true, preferences: prefs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updatePreferences = async (req, res) => {
    try {
        await notificationModel.upsertPreferences(req.userId, req.body);
        // Also update in-memory filter for live pipeline
        deliveryEngine.setUserFilter(req.userId, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Issue #615: Digest, Retry, Receipt Endpoints ─────────────────────────────

/**
 * GET /api/notifications/digest
 * Return + flush the current digest window for the authenticated user.
 */
exports.getDigest = (req, res) => {
    try {
        const bundle = eventStream.flushDigestWindow(req.userId);
        if (!bundle) return res.json({ success: true, digest: null, message: 'No pending digest.' });
        res.json({ success: true, digest: bundle });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/notifications/retry
 * Drain and re-emit any delivery-failed notifications due for retry.
 * Body: { channel? }  — optional channel filter
 */
exports.retryFailed = (req, res) => {
    try {
        const due = deliveryEngine.drainRetryQueue();
        // Re-issue receipts for all due items
        const reissued = due.map(item => ({
            token: item.token,
            userId: item.userId,
            attempt: item.attempt + 1,
            event: item.event
        }));
        res.json({ success: true, retried: reissued.length, items: reissued });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/notifications/receipts
 * Return delivery receipts for the authenticated user.
 */
exports.getReceipts = (req, res) => {
    try {
        const receipts = deliveryEngine.getUserReceipts(req.userId);
        res.json({ success: true, receipts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/notifications/receipts/:token/ack
 * Acknowledge a delivery receipt (client confirms it received the notification).
 */
exports.ackReceipt = (req, res) => {
    try {
        const ok = deliveryEngine.acknowledgeReceipt(req.params.token);
        res.json({ success: ok, message: ok ? 'Receipt acknowledged.' : 'Receipt not found.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/notifications/pipeline-stats
 * Return retry queue stats and pending digest windows (admin/debug).
 */
exports.getPipelineStats = (req, res) => {
    try {
        res.json({
            success: true,
            retryStats: deliveryEngine.getRetryStats(),
            pendingDigests: eventStream.getPendingDigests(),
            deliveryEngine: deliveryEngine.getStatistics()
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Export deliveryEngine so routes & socket can share the same instance
exports.deliveryEngine = deliveryEngine;
