/**
 * Predictive Analytics Controller
 * Handles forecasting, velocity tracking, and burnout detection
 * Extended (Issue #616): /burnout-risk and /rebalance endpoints.
 */

const forecastingService = require('../services/forecasting.service');
const sentimentEngine = require('../services/sentiment-trend.engine');
const sentimentAnalyzer = require('../services/sentiment-analyzer.service');
const xpCalculator = require('../services/xp-calculator.service');
const contribAggregator = require('../services/contribution-aggregator.service');
const sprintOptimizer = require('../services/sprint-optimizer.service');

class PredictiveController {
    /**
     * Get team velocity metrics
     */
    async getVelocity(req, res) {
        try {
            const { repo, owner, timeWindow = 4 } = req.query;

            if (!repo || !owner) {
                return res.status(400).json({
                    error: 'Missing required parameters: repo, owner'
                });
            }

            const velocity = await forecastingService.calculateVelocity(
                owner,
                repo,
                parseInt(timeWindow)
            );

            res.json({
                success: true,
                data: velocity
            });
        } catch (error) {
            console.error('Error getting velocity:', error);
            res.status(500).json({
                error: 'Failed to calculate velocity',
                message: error.message
            });
        }
    }

    /**
     * Forecast milestone completion
     */
    async forecastMilestone(req, res) {
        try {
            const { repo, owner, milestone, remainingIssues, remainingPoints } = req.body;

            if (!repo || !owner || !milestone) {
                return res.status(400).json({
                    error: 'Missing required parameters: repo, owner, milestone'
                });
            }

            const forecast = await forecastingService.forecastMilestone(
                owner,
                repo,
                milestone,
                remainingIssues,
                remainingPoints
            );

            res.json({
                success: true,
                data: forecast
            });
        } catch (error) {
            console.error('Error forecasting milestone:', error);
            res.status(500).json({
                error: 'Failed to forecast milestone',
                message: error.message
            });
        }
    }

    /**
     * Run what-if scenario simulation
     */
    async simulateScenario(req, res) {
        try {
            const { repo, owner, scenarios } = req.body;

            if (!repo || !owner || !scenarios || !Array.isArray(scenarios)) {
                return res.status(400).json({
                    error: 'Missing required parameters: repo, owner, scenarios (array)'
                });
            }

            const results = [];

            for (const scenario of scenarios) {
                const result = await forecastingService.simulateScenarios(
                    owner,
                    repo,
                    scenario
                );
                results.push(result);
            }

            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            console.error('Error simulating scenarios:', error);
            res.status(500).json({
                error: 'Failed to simulate scenarios',
                message: error.message
            });
        }
    }

    /**
     * Analyze workflow bottlenecks
     */
    async analyzeBottlenecks(req, res) {
        try {
            const { repo, owner, timeWindow = 30 } = req.query;

            if (!repo || !owner) {
                return res.status(400).json({
                    error: 'Missing required parameters: repo, owner'
                });
            }

            const bottlenecks = await forecastingService.analyzeBottlenecks(
                owner,
                repo,
                parseInt(timeWindow)
            );

            res.json({
                success: true,
                data: bottlenecks
            });
        } catch (error) {
            console.error('Error analyzing bottlenecks:', error);
            res.status(500).json({
                error: 'Failed to analyze bottlenecks',
                message: error.message
            });
        }
    }

    /**
     * Get sprint burndown data
     */
    async getBurndown(req, res) {
        try {
            const { repo, owner, sprintStart, sprintEnd, totalPoints } = req.query;

            if (!repo || !owner || !sprintStart || !sprintEnd) {
                return res.status(400).json({
                    error: 'Missing required parameters: repo, owner, sprintStart, sprintEnd'
                });
            }

            const burndown = await forecastingService.calculateBurndown(
                owner,
                repo,
                new Date(sprintStart),
                new Date(sprintEnd),
                parseInt(totalPoints)
            );

            res.json({
                success: true,
                data: burndown
            });
        } catch (error) {
            console.error('Error calculating burndown:', error);
            res.status(500).json({
                error: 'Failed to calculate burndown',
                message: error.message
            });
        }
    }

    /**
     * Detect burnout risk for team
     */
    async detectBurnout(req, res) {
        try {
            const { repo, owner, timeWindow = 30 } = req.query;

            if (!repo || !owner) {
                return res.status(400).json({
                    error: 'Missing required parameters: repo, owner'
                });
            }

            // This would need integration with GitHub API to fetch actual data
            // For now, using placeholder structure
            const activities = req.body.activities || [];
            const sentiments = req.body.sentiments || [];
            const developers = req.body.developers || [];

            if (developers.length === 0) {
                return res.status(400).json({
                    error: 'No developers provided for analysis'
                });
            }

            const heatmap = await sentimentEngine.generateBurnoutHeatmap(
                developers,
                activities,
                sentiments
            );

            res.json({
                success: true,
                data: heatmap
            });
        } catch (error) {
            console.error('Error detecting burnout:', error);
            res.status(500).json({
                error: 'Failed to detect burnout',
                message: error.message
            });
        }
    }

    /**
     * Analyze sentiment trends
     */
    async analyzeSentiment(req, res) {
        try {
            const { repo, owner, type = 'pr', timeWindow = 30 } = req.query;

            if (!repo || !owner) {
                return res.status(400).json({
                    error: 'Missing required parameters: repo, owner'
                });
            }

            let analysis;

            if (type === 'pr') {
                const pullRequests = req.body.pullRequests || [];
                analysis = await sentimentEngine.analyzePRComments(pullRequests);
            } else if (type === 'commits') {
                const commits = req.body.commits || [];
                analysis = sentimentEngine.analyzeCommits(commits);
            } else {
                return res.status(400).json({
                    error: 'Invalid type. Must be "pr" or "commits"'
                });
            }

            res.json({
                success: true,
                data: analysis
            });
        } catch (error) {
            console.error('Error analyzing sentiment:', error);
            res.status(500).json({
                error: 'Failed to analyze sentiment',
                message: error.message
            });
        }
    }

    /**
     * Get comprehensive project health
     */
    async getProjectHealth(req, res) {
        try {
            const { repo, owner, timeWindow = 30 } = req.query;

            if (!repo || !owner) {
                return res.status(400).json({
                    error: 'Missing required parameters: repo, owner'
                });
            }

            // Gather all metrics in parallel
            const [velocity, bottlenecks] = await Promise.all([
                forecastingService.calculateVelocity(owner, repo, 4),
                forecastingService.analyzeBottlenecks(owner, repo, parseInt(timeWindow))
            ]);

            const health = {
                velocity: {
                    current: velocity.current,
                    trend: velocity.trend,
                    confidence: velocity.confidence
                },
                bottlenecks: {
                    count: Object.keys(bottlenecks).length,
                    critical: bottlenecks.slowReviews?.severity === 'high' ||
                        bottlenecks.concentrationRisk?.severity === 'high',
                    details: bottlenecks
                },
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                data: health
            });
        } catch (error) {
            console.error('Error getting project health:', error);
            res.status(500).json({
                error: 'Failed to get project health',
                message: error.message
            });
        }
    }

    /**
     * Compare historical performance
     */
    async compareHistorical(req, res) {
        try {
            const { repo, owner, periods } = req.body;

            if (!repo || !owner || !periods || !Array.isArray(periods)) {
                return res.status(400).json({
                    error: 'Missing required parameters: repo, owner, periods (array)'
                });
            }

            const comparison = await forecastingService.compareHistoricalPerformance(
                owner,
                repo,
                periods
            );

            res.json({
                success: true,
                data: comparison
            });
        } catch (error) {
            console.error('Error comparing historical data:', error);
            res.status(500).json({
                error: 'Failed to compare historical performance',
                message: error.message
            });
        }
    }

    // ─── Issue #616: Burnout Detection ───────────────────────────────────────

    /**
     * POST /api/predictive/burnout-risk
     * Accepts: { team: [{id, name, velocity, weeklyXP?, weeklyPoints?}] }
     * Returns: per-developer burnout risk scores drawn from all 4 services.
     */
    async getBurnoutRisk(req, res) {
        try {
            const { team } = req.body;

            // Build demo team if none provided
            const devTeam = team || [
                { id: 'alice', name: 'Alice', velocity: 5, weeklyXP: [80, 85, 79, 60, 50, 40, 38], weeklyPoints: [18, 20, 22, 24, 25, 26, 28] },
                { id: 'bob', name: 'Bob', velocity: 6, weeklyXP: [90, 88, 91, 89, 85, 87, 86], weeklyPoints: [16, 14, 15, 16, 14, 15, 13] },
                { id: 'charlie', name: 'Charlie', velocity: 4, weeklyXP: [60, 55, 48, 40, 32, 28, 25], weeklyPoints: [14, 16, 18, 20, 22, 24, 26] },
                { id: 'dave', name: 'Dave', velocity: 7, weeklyXP: [100, 102, 99, 101, 98, 100, 99], weeklyPoints: [20, 19, 21, 20, 22, 20, 21] },
                { id: 'eve', name: 'Eve', velocity: 5, weeklyXP: [70, 68, 71, 65, 60, 55, 50], weeklyPoints: [15, 16, 17, 18, 20, 22, 24] }
            ];

            const riskProfiles = devTeam.map(dev => {
                // 1. Velocity decay from XP trends
                const decayResult = xpCalculator.detectVelocityDecay(dev.weeklyXP || [80, 75, 70, 65]);

                // 2. Overload signal from story points
                const overloadResult = xpCalculator.detectOverloadSignal(dev.weeklyPoints || [15, 16, 18, 20], dev.velocity * 10 / 5);

                // 3. Mood/sentiment flag
                const moodResult = sentimentAnalyzer.buildMoodTimeline(dev.id);

                // 4. Contribution spike detection (mock contribution data)
                const mockContribs = Object.fromEntries(
                    Array.from({ length: 28 }, (_, i) => {
                        const d = new Date(); d.setDate(d.getDate() - i);
                        const key = d.toISOString().split('T')[0];
                        return [key, Math.floor(Math.random() * (i < 7 ? 15 : 8))];
                    })
                );
                const loadMetrics = contribAggregator.computeRollingLoadMetrics(mockContribs);

                // Composite burnout risk score (0-100; higher = more at risk)
                let riskScore = 0;
                riskScore += Math.min(40, Math.max(0, decayResult.decayRate * 0.8));  // up to 40
                riskScore += overloadResult.capacityRatio > 1 ? Math.min(30, (overloadResult.capacityRatio - 1) * 60) : 0; // up to 30
                if (moodResult.burnoutFlag) riskScore += 20;
                if (loadMetrics.spikeDetected) riskScore += 10;
                riskScore = Math.round(Math.min(100, riskScore));

                return {
                    username: dev.id,
                    name: dev.name,
                    riskScore,
                    riskLevel: riskScore >= 70 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 30 ? 'MODERATE' : 'LOW',
                    atRisk: riskScore >= 50,
                    signals: {
                        velocityDecay: decayResult,
                        overload: overloadResult,
                        moodFlag: { burnoutFlag: moodResult.burnoutFlag, moodTrend: moodResult.moodTrend },
                        spikeDetected: loadMetrics.spikeDetected
                    }
                };
            }).sort((a, b) => b.riskScore - a.riskScore);

            const atRiskCount = riskProfiles.filter(d => d.atRisk).length;

            res.json({
                success: true,
                data: {
                    riskProfiles,
                    summary: {
                        totalDevs: riskProfiles.length,
                        atRiskCount,
                        criticalCount: riskProfiles.filter(d => d.riskLevel === 'CRITICAL').length,
                        avgRiskScore: parseFloat((riskProfiles.reduce((s, d) => s + d.riskScore, 0) / riskProfiles.length).toFixed(1))
                    },
                    generatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Burnout risk error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/predictive/rebalance
     * Accepts: { team, assignments, burnoutSignals }
     * Returns: recommended ticket reassignments and updated sprint plan.
     */
    async rebalanceWorkload(req, res) {
        try {
            const {
                team = [
                    { id: 'alice', name: 'Alice', velocity: 5, currentLoad: 45 },
                    { id: 'bob', name: 'Bob', velocity: 6, currentLoad: 30 },
                    { id: 'charlie', name: 'Charlie', velocity: 4, currentLoad: 50 },
                    { id: 'dave', name: 'Dave', velocity: 7, currentLoad: 20 },
                    { id: 'eve', name: 'Eve', velocity: 5, currentLoad: 38 }
                ],
                assignments = [
                    { taskId: 'T-1', taskName: 'Refactor auth module', assignedTo: 'alice', points: 13 },
                    { taskId: 'T-2', taskName: 'Fix API rate limiting', assignedTo: 'alice', points: 8 },
                    { taskId: 'T-3', taskName: 'Add unit tests for cart', assignedTo: 'charlie', points: 8 },
                    { taskId: 'T-4', taskName: 'Migrate DB schema', assignedTo: 'charlie', points: 13 },
                    { taskId: 'T-5', taskName: 'Update dashboard UI', assignedTo: 'bob', points: 5 }
                ],
                burnoutSignals
            } = req.body;

            // If no external signals, run a quick burnout risk scan first
            const signals = burnoutSignals || team.map(d => ({
                username: d.id,
                riskScore: d.currentLoad > (d.velocity * 8) ? 65 : 20,
                moodTrend: 'stable',
                velocitySignal: 'STABLE'
            }));

            const atRiskList = sprintOptimizer.identifyAtRiskContributors(team, signals);
            const rebalanceResult = sprintOptimizer.rebalanceWorkload(assignments, atRiskList, team);

            res.json({
                success: true,
                data: {
                    atRiskContributors: atRiskList.filter(d => d.atRisk),
                    ...rebalanceResult
                }
            });
        } catch (error) {
            console.error('Rebalance error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new PredictiveController();
