/**
 * Code Analyzer Service
 * Calculates complexity metrics and technical debt for code files.
 *
 * Extended (Issue #617): CQAS Orchestrator
 * Aggregates complexity, vulnerability, taint, duplication, and architecture
 * sub-scores into a unified Code Quality Aggregate Score with configurable
 * weights, historical delta tracking, and CI gate support.
 */

const complexityAnalyzer = require('./complexity-analyzer.service');
const taintAnalyzer = require('./taint-analyzer.service');
const astFingerprint = require('./ast-fingerprint.service');
const archValidator = require('./architecture-validator.service');
const vulnPath = require('./vulnerability-path.service');

// Default CQAS weights (must sum to 1.0)
const DEFAULT_WEIGHTS = {
    complexity: 0.25,
    vulnerability: 0.25,
    taint: 0.20,
    duplication: 0.15,
    architecture: 0.15
};

class CodeAnalyzerService {

    constructor() {
        // Historical CQAS store: branchKey -> [{ commitId, score, dimensions, timestamp }]
        this._cqasHistory = new Map();
        this._historyLimit = 20; // Keep last 20 snapshots per branch
    }

    // ─── Existing Methods ─────────────────────────────────────────────────────

    analyzeRepository(repoName) {
        const files = this.getMockFiles();
        const metrics = files.map(f => this.analyzeFile(f));

        return {
            repoName,
            totalFiles: files.length,
            avgComplexity: this.average(metrics.map(m => m.cyclomaticComplexity)),
            avgMaintainability: this.average(metrics.map(m => m.maintainabilityIndex)),
            totalDebt: metrics.reduce((sum, m) => sum + m.debtMinutes, 0),
            files: metrics,
            trends: this.getMockTrends(),
            timestamp: new Date()
        };
    }

    analyzeFile(file) {
        const loc = file.lines;
        const cyclomaticComplexity = Math.floor(Math.random() * 20) + 1;
        const cognitiveComplexity = Math.floor(cyclomaticComplexity * 1.2);
        const maintainabilityIndex = Math.max(0, 100 - cyclomaticComplexity * 3);
        const debtMinutes = cyclomaticComplexity > 10 ? (cyclomaticComplexity - 10) * 5 : 0;

        return {
            path: file.path,
            lines: loc,
            cyclomaticComplexity,
            cognitiveComplexity,
            maintainabilityIndex,
            debtMinutes,
            codeSmells: this.detectSmells(cyclomaticComplexity),
            rating: this.getRating(maintainabilityIndex)
        };
    }

    detectSmells(complexity) {
        const smells = [];
        if (complexity > 15) smells.push({ type: 'High Complexity', severity: 'critical' });
        if (complexity > 10) smells.push({ type: 'Long Method', severity: 'major' });
        if (Math.random() > 0.7) smells.push({ type: 'Duplicate Code', severity: 'minor' });
        return smells;
    }

    getRating(maintainability) {
        if (maintainability >= 80) return 'A';
        if (maintainability >= 60) return 'B';
        if (maintainability >= 40) return 'C';
        if (maintainability >= 20) return 'D';
        return 'F';
    }

    getMockFiles() {
        return [
            { path: 'src/app.js', lines: 250 },
            { path: 'src/utils/auth.js', lines: 180 },
            { path: 'src/services/api.js', lines: 320 },
            { path: 'src/components/Dashboard.jsx', lines: 420 },
            { path: 'src/controllers/user.controller.js', lines: 280 },
            { path: 'src/middleware/validation.js', lines: 150 },
            { path: 'src/routes/index.js', lines: 90 }
        ];
    }

    getMockTrends() {
        return [
            { date: '2026-01-12', avgComplexity: 8.2, debtHours: 12 },
            { date: '2026-01-14', avgComplexity: 8.5, debtHours: 14 },
            { date: '2026-01-16', avgComplexity: 7.8, debtHours: 11 },
            { date: '2026-01-18', avgComplexity: 7.2, debtHours: 9 }
        ];
    }

    average(arr) {
        return arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0;
    }

    getAiRecommendations(metrics) {
        const critical = metrics.files.filter(f => f.rating === 'D' || f.rating === 'F');
        return critical.map(f => ({
            file: f.path,
            suggestion: `Refactor ${f.path} - complexity is ${f.cyclomaticComplexity}. Consider breaking into smaller functions.`
        }));
    }

    // ─── Issue #617: CQAS Orchestrator ───────────────────────────────────────

    /**
     * Compute a full Code Quality Aggregate Score (CQAS).
     * Collects normalized sub-scores from all five analyzers,
     * applies configurable weights, and returns the composite.
     *
     * @param {string} repoName
     * @param {Object} options
     * @param {Object} options.weights  - override default dimension weights
     * @param {Array}  options.taintFlows   - pre-computed flows (optional)
     * @param {Array}  options.violations   - pre-computed arch violations (optional)
     * @returns {Object} CQAS result
     */
    computeCQAS(repoName = 'demo-repo', options = {}) {
        const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };

        // Collect sub-scores
        const complexityScore = complexityAnalyzer.getNormalizedComplexityScore(repoName);
        const taintScore = taintAnalyzer.getNormalizedTaintScore(options.taintFlows || null);
        const duplicationScore = astFingerprint.getNormalizedDuplicationScore([], []);
        const archScore = archValidator.getNormalizedArchitectureScore(options.violations || null);
        const vulnScore = this._computeVulnerabilityScore();

        const dimensions = {
            complexity: complexityScore,
            vulnerability: vulnScore,
            taint: taintScore,
            duplication: duplicationScore,
            architecture: archScore
        };

        // Weighted composite
        let composite = 0;
        let totalWeight = 0;
        for (const [dim, weight] of Object.entries(weights)) {
            if (dimensions[dim]) {
                composite += dimensions[dim].score * weight;
                totalWeight += weight;
            }
        }
        const cqasScore = totalWeight > 0 ? parseFloat((composite / totalWeight).toFixed(1)) : 0;

        return {
            repoName,
            cqasScore,
            grade: this._scoreToGrade(cqasScore),
            label: cqasScore >= 80 ? 'EXCELLENT' : cqasScore >= 65 ? 'GOOD' : cqasScore >= 50 ? 'FAIR' : cqasScore >= 35 ? 'POOR' : 'CRITICAL',
            weights,
            dimensions,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Compute CQAS and persist it to history for a branch/commit key.
     * @param {string} repoName
     * @param {string} branch
     * @param {string} commitId  - short SHA or semantic label
     * @param {Object} options   - forwarded to computeCQAS
     * @returns {Object} CQAS result with delta from previous snapshot
     */
    computeAndRecord(repoName, branch = 'main', commitId = 'HEAD', options = {}) {
        const result = this.computeCQAS(repoName, options);
        const branchKey = `${repoName}::${branch}`;

        if (!this._cqasHistory.has(branchKey)) this._cqasHistory.set(branchKey, []);
        const history = this._cqasHistory.get(branchKey);

        const previous = history.length > 0 ? history[history.length - 1] : null;
        const delta = previous !== null ? parseFloat((result.cqasScore - previous.score).toFixed(1)) : null;

        const snapshot = {
            commitId,
            score: result.cqasScore,
            grade: result.grade,
            dimensions: Object.fromEntries(
                Object.entries(result.dimensions).map(([k, v]) => [k, v.score])
            ),
            timestamp: result.generatedAt
        };

        history.push(snapshot);
        if (history.length > this._historyLimit) history.shift();

        return { ...result, delta, previousScore: previous ? previous.score : null, snapshot };
    }

    /**
     * Return the full CQAS history for a branch.
     * @param {string} repoName
     * @param {string} branch
     * @returns {Array} ordered snapshots (oldest first)
     */
    getCQASHistory(repoName, branch = 'main') {
        const branchKey = `${repoName}::${branch}`;
        return this._cqasHistory.get(branchKey) || this._generateMockHistory(repoName, branch);
    }

    /**
     * CI Gate: fail if CQAS drops below threshold or regresses more than maxDelta.
     * @param {string} repoName
     * @param {string} branch
     * @param {string} commitId
     * @param {Object} gateConfig  - { minScore: 60, maxRegressionDelta: 5 }
     * @returns {Object} { passed, reason, cqasScore, delta, ... }
     */
    evaluateCIGate(repoName, branch = 'main', commitId = 'HEAD', gateConfig = {}) {
        const { minScore = 60, maxRegressionDelta = 5 } = gateConfig;
        const result = this.computeAndRecord(repoName, branch, commitId, {});

        const failReasons = [];

        if (result.cqasScore < minScore) {
            failReasons.push(`CQAS score ${result.cqasScore} is below minimum threshold of ${minScore}`);
        }

        if (result.delta !== null && result.delta < -maxRegressionDelta) {
            failReasons.push(`Score regressed by ${Math.abs(result.delta)} points (max allowed: ${maxRegressionDelta})`);
        }

        // Dimension-level gate: any dimension in CRITICAL state fails CI
        const criticalDims = Object.entries(result.dimensions)
            .filter(([, v]) => v.label === 'CRITICAL')
            .map(([k]) => k);

        if (criticalDims.length > 0) {
            failReasons.push(`Critical quality failure in dimensions: ${criticalDims.join(', ')}`);
        }

        return {
            passed: failReasons.length === 0,
            failReasons,
            cqasScore: result.cqasScore,
            grade: result.grade,
            delta: result.delta,
            previousScore: result.previousScore,
            dimensions: result.dimensions,
            gateConfig,
            commitId,
            branch,
            evaluatedAt: new Date().toISOString()
        };
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    /**
     * Compute normalized vulnerability score from vuln-path service (0-100).
     * Higher score = fewer/less severe exploit paths.
     */
    _computeVulnerabilityScore() {
        // Mock exploit paths for the demo
        const mockPaths = [
            { riskScore: 65, reachability: 80 },
            { riskScore: 30, reachability: 40 }
        ];
        const avgRisk = mockPaths.reduce((s, p) => s + p.riskScore, 0) / mockPaths.length;
        const score = Math.max(0, Math.round(100 - avgRisk));

        return {
            dimension: 'vulnerability',
            score,
            label: score >= 80 ? 'GOOD' : score >= 60 ? 'FAIR' : score >= 40 ? 'POOR' : 'CRITICAL',
            breakdown: {
                avgRiskScore: parseFloat(avgRisk.toFixed(1)),
                totalExploitPaths: mockPaths.length
            }
        };
    }

    _scoreToGrade(score) {
        if (score >= 90) return 'A+';
        if (score >= 80) return 'A';
        if (score >= 70) return 'B';
        if (score >= 60) return 'C';
        if (score >= 50) return 'D';
        return 'F';
    }

    _generateMockHistory(repoName, branch) {
        const base = [72, 74, 71, 75, 78, 76, 73, 77];
        return base.map((score, idx) => ({
            commitId: `abc${idx + 100}`,
            score,
            grade: this._scoreToGrade(score),
            dimensions: { complexity: 75, vulnerability: 70, taint: 68, duplication: 80, architecture: 77 },
            timestamp: new Date(Date.now() - (base.length - idx) * 86400000).toISOString()
        }));
    }
}

module.exports = new CodeAnalyzerService();
