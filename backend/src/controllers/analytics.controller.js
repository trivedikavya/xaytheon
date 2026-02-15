const analyticsModel = require("../models/analytics.model");

/**
 * Create a new analytics snapshot
 * POST /api/analytics/snapshot
 */
exports.createSnapshot = async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const { githubUsername, snapshotData } = req.body;

        if (!githubUsername || !snapshotData) {
            return res.status(400).json({
                success: false,
                message: "GitHub username and snapshot data are required",
            });
        }

        const snapshotId = await analyticsModel.createSnapshot(
            userId,
            githubUsername,
            snapshotData
        );

        res.status(201).json({
            success: true,
            message: "Snapshot created successfully",
            snapshotId,
        });
    } catch (error) {
        console.error("Error creating snapshot:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create snapshot",
            error: error.message,
        });
    }
};

/**
 * Get snapshots by date range
 * GET /api/analytics/snapshots?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getSnapshots = async (req, res) => {
    try {
        const userId = req.userId;
        const { startDate, endDate, limit } = req.query;

        let snapshots;

        if (startDate && endDate) {
            snapshots = await analyticsModel.getSnapshotsByDateRange(
                userId,
                startDate,
                endDate
            );
        } else {
            snapshots = await analyticsModel.getAllSnapshots(
                userId,
                limit ? parseInt(limit) : 100
            );
        }

        res.json({
            success: true,
            count: snapshots.length,
            snapshots,
        });
    } catch (error) {
        console.error("Error fetching snapshots:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch snapshots",
            error: error.message,
        });
    }
};

/**
 * Get latest snapshot
 * GET /api/analytics/latest
 */
exports.getLatestSnapshot = async (req, res) => {
    try {
        const userId = req.userId;
        const { githubUsername } = req.query;

        const snapshot = await analyticsModel.getLatestSnapshot(userId);

        // Check if data is stale (older than 1 hour)
        const STALE_THRESHOLD = 60 * 60 * 1000;
        const isStale = !snapshot || ((new Date() - new Date(snapshot.snapshot_date + 'Z')) > STALE_THRESHOLD); // Append Z for UTC if needed, or assume local

        const targetUsername = githubUsername || (snapshot ? snapshot.github_username : null);

        if (isStale && targetUsername) {
            console.log(`[Analytics] Data stale for ${targetUsername}, enqueueing job...`);
            const { addAnalyticsJob } = require('../queue/analytics.queue');

            try {
                await addAnalyticsJob(userId, targetUsername);
            } catch (err) {
                console.error("Failed to enqueue job (Redis might be down):", err.message);
                // Continue to return stale data if available
            }
        }

        if (!snapshot) {
            if (targetUsername) {
                return res.json({
                    success: true,
                    status: 'processing',
                    message: 'Analytics calculation started in background.',
                    snapshot: null
                });
            }

            return res.status(404).json({
                success: false,
                message: "No snapshots found. Provide githubUsername to start tracking.",
            });
        }

        res.json({
            success: true,
            status: isStale ? 'refreshing' : 'fresh',
            snapshot,
        });
    } catch (error) {
        console.error("Error fetching latest snapshot:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch latest snapshot",
            error: error.message,
        });
    }
};

/**
 * Get aggregated statistics
 * GET /api/analytics/stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getAggregatedStats = async (req, res) => {
    try {
        const userId = req.userId;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Start date and end date are required",
            });
        }

        const stats = await analyticsModel.getAggregatedStats(
            userId,
            startDate,
            endDate
        );

        res.json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error("Error fetching aggregated stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch aggregated statistics",
            error: error.message,
        });
    }
};

/**
 * Get growth metrics
 * GET /api/analytics/growth?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getGrowthMetrics = async (req, res) => {
    try {
        const userId = req.userId;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Start date and end date are required",
            });
        }

        const growth = await analyticsModel.getGrowthMetrics(
            userId,
            startDate,
            endDate
        );

        if (!growth) {
            return res.status(404).json({
                success: false,
                message: "Not enough data to calculate growth metrics",
            });
        }

        res.json({
            success: true,
            growth,
        });
    } catch (error) {
        console.error("Error fetching growth metrics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch growth metrics",
            error: error.message,
        });
    }
};

/**
 * Export analytics data as JSON or CSV
 */
exports.exportData = async (req, res) => {
    try {
        const userId = req.userId;
        const { format = "json", startDate, endDate } = req.query;

        let snapshots = await analyticsModel.getSnapshotsByDateRange(userId, startDate, endDate);

        if (format === "csv") {
            const headers = ["Date", "Stars", "Followers", "Following", "Public Repos", "Total Commits"];
            const csvRows = [headers.join(",")];

            snapshots.forEach((s) => {
                const row = [
                    s.snapshot_date,
                    s.stars,
                    s.followers,
                    s.following,
                    s.public_repos,
                    s.total_commits
                ];
                csvRows.push(row.join(","));
            });

            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename=analytics_${Date.now()}.csv`);
            return res.send(csvRows.join("\n"));
        }

        // Default to JSON
        res.setHeader("Content-Type", "application/json");
        res.json({
            exportDate: new Date().toISOString(),
            total: snapshots.length,
            snapshots
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Export failed", error: error.message });
    }
};

/**
 * Delete old snapshots
 * DELETE /api/analytics/cleanup?days=365
 */
exports.cleanupOldSnapshots = async (req, res) => {
    try {
        const { days = 365 } = req.query;
        const deletedCount = await analyticsModel.deleteOldSnapshots(
            parseInt(days)
        );

        res.json({
            success: true,
            message: `Deleted ${deletedCount} old snapshots`,
            deletedCount,
        });
    } catch (error) {
        console.error("Error cleaning up snapshots:", error);
        res.status(500).json({
            success: false,
            message: "Failed to cleanup old snapshots",
            error: error.message,
        });
    }
};

/**
 * FORENSIC TIME-TRAVEL: Get Historical Health Timeline
 * GET /api/analytics/forensic/timeline?weeksBack=26
 */
exports.getForensicTimeline = async (req, res) => {
    try {
        const gitTimeMachine = require('../services/git-time-machine.service');
        const { weeksBack = 26, repoPath = './' } = req.query;

        // Get health snapshots
        const snapshots = await gitTimeMachine.aggregateHealthSnapshots(
            repoPath,
            parseInt(weeksBack)
        );

        // Calculate summary statistics
        const avgHealth = snapshots.reduce((sum, s) => sum + s.healthScore, 0) / snapshots.length;
        const minHealth = Math.min(...snapshots.map(s => s.healthScore));
        const maxHealth = Math.max(...snapshots.map(s => s.healthScore));

        const criticalWeeks = snapshots.filter(s => s.status === 'CRITICAL' || s.status === 'POOR').length;

        res.json({
            success: true,
            data: {
                snapshots,
                summary: {
                    totalWeeks: snapshots.length,
                    averageHealth: Math.round(avgHealth),
                    minHealth,
                    maxHealth,
                    criticalWeeks,
                    healthTrend: snapshots[snapshots.length - 1].healthScore - snapshots[0].healthScore,
                    currentStatus: snapshots[snapshots.length - 1].status
                },
                timeRange: {
                    start: snapshots[0].date,
                    end: snapshots[snapshots.length - 1].date,
                    startTimestamp: snapshots[0].timestamp,
                    endTimestamp: snapshots[snapshots.length - 1].timestamp
                }
            }
        });
    } catch (error) {
        console.error('Error fetching forensic timeline:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch forensic timeline',
            error: error.message
        });
    }
};

/**
 * FORENSIC TIME-TRAVEL: Get Interpolated Health at Specific Time
 * GET /api/analytics/forensic/at-time?timestamp=1234567890
 */
exports.getHealthAtTime = async (req, res) => {
    try {
        const gitTimeMachine = require('../services/git-time-machine.service');
        const { timestamp, weeksBack = 26 } = req.query;

        if (!timestamp) {
            return res.status(400).json({
                success: false,
                message: 'Timestamp parameter is required'
            });
        }

        // Get all snapshots
        const snapshots = await gitTimeMachine.aggregateHealthSnapshots('./', parseInt(weeksBack));

        // Interpolate health at specific time
        const healthData = gitTimeMachine.interpolateHealthAtTime(snapshots, parseInt(timestamp));

        res.json({
            success: true,
            data: healthData
        });
    } catch (error) {
        console.error('Error fetching health at time:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch health data',
            error: error.message
        });
    }
};

