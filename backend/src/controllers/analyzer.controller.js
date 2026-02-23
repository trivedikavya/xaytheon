/**
 * Analyzer Controller
 * Extended (Issue #617): CQAS endpoints — /cqas, /cqas/history, /cqas/ci-gate
 */

const analyzerService = require('../services/code-analyzer.service');

// ─── Existing Endpoints ───────────────────────────────────────────────────────

exports.analyzeRepo = (req, res) => {
    try {
        const { repo } = req.query;
        const analysis = analyzerService.analyzeRepository(repo || 'SatyamPandey-07/xaytheon');
        res.json(analysis);
    } catch (error) {
        res.status(500).json({ message: 'Analysis failed' });
    }
};

exports.getRecommendations = (req, res) => {
    try {
        const { repo } = req.query;
        const analysis = analyzerService.analyzeRepository(repo || 'SatyamPandey-07/xaytheon');
        const recs = analyzerService.getAiRecommendations(analysis);
        res.json({ recommendations: recs });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get recommendations' });
    }
};

// ─── Issue #617: CQAS Endpoints ──────────────────────────────────────────────

/**
 * POST /api/analyzer/cqas
 * Compute full Code Quality Aggregate Score for a repo+branch+commit.
 * Body: { repo, branch, commitId, weights, minScore, maxRegressionDelta }
 */
exports.getCQAS = (req, res) => {
    try {
        const {
            repo = 'SatyamPandey-07/xaytheon',
            branch = 'main',
            commitId = 'HEAD',
            weights
        } = req.body;

        const result = analyzerService.computeAndRecord(repo, branch, commitId, { weights });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('CQAS error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/analyzer/cqas/history
 * Return historical CQAS snapshots for a repo+branch.
 * Query: ?repo=...&branch=...
 */
exports.getCQASHistory = (req, res) => {
    try {
        const { repo = 'SatyamPandey-07/xaytheon', branch = 'main' } = req.query;
        const history = analyzerService.getCQASHistory(repo, branch);

        // Compute trend direction
        const trend = history.length >= 2
            ? (history[history.length - 1].score - history[0].score > 0 ? 'improving' : 'degrading')
            : 'stable';

        res.json({ success: true, data: { history, trend, branch, repo } });
    } catch (error) {
        console.error('CQAS history error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/analyzer/cqas/ci-gate
 * Evaluate CI gate: pass/fail based on score threshold and regression delta.
 * Body: { repo, branch, commitId, minScore, maxRegressionDelta }
 * Returns: { passed, failReasons, cqasScore, delta, ... }
 */
exports.evaluateCIGate = (req, res) => {
    try {
        const {
            repo = 'SatyamPandey-07/xaytheon',
            branch = 'main',
            commitId = 'HEAD',
            minScore = 60,
            maxRegressionDelta = 5
        } = req.body;

        const result = analyzerService.evaluateCIGate(repo, branch, commitId, { minScore, maxRegressionDelta });

        // Return 424 (Failed Dependency) when CI gate fails so CI systems can detect it
        const statusCode = result.passed ? 200 : 424;
        res.status(statusCode).json({ success: result.passed, data: result });
    } catch (error) {
        console.error('CI gate error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
