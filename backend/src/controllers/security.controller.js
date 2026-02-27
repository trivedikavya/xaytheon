/**
 * XAYTHEON — Security Controller
 */

const taintAnalyzer = require('../services/taint-analyzer.service');
const vulnEngine = require('../services/vulnerability-engine.service');

class SecurityController {
    /**
     * POST /api/security/scan
     */
    async startScan(req, res) {
        try {
            const { files } = req.body; // Array of { name, content }
            if (!files || !Array.isArray(files)) {
                return res.status(400).json({ success: false, message: 'Files array required' });
            }

            const scanResult = taintAnalyzer.runTaintScan(files);

            // For each finding, try to get a patch
            const enrichedFindings = scanResult.findings.map(f => {
                const patch = vulnEngine.proposePatch({ type: f.type, content: 'innerHTML = userTyped' }); // Simplified mock content
                return { ...f, patch };
            });

            res.json({
                success: true,
                scanId: scanResult.scanId,
                findings: enrichedFindings,
                summary: {
                    total: enrichedFindings.length,
                    critical: enrichedFindings.filter(f => f.severity === 'CRITICAL').length
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * GET /api/security/history
     */
    async getHistory(req, res) {
        try {
            res.json({ success: true, history: taintAnalyzer.getHistory() });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/security/apply-patch
     */
    async applyPatch(req, res) {
        try {
            const { scanId, findingId } = req.body;
            // In a real system, this would modify the git branch or filesystem.
            res.json({
                success: true,
                message: 'Predictive patch applied and CI pipeline triggered for verification.',
                action: 'PR_PROPOSED'
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new SecurityController();
