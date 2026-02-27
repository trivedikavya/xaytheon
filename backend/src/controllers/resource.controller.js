/**
 * XAYTHEON — Resource Controller
 */

const resourceSvc = require('../services/resource-optimization.service');
const costSvc = require('../services/cost-projector.service');

class ResourceController {
    /**
     * GET /api/resource/efficiency
     */
    async getEfficiencyReport(req, res) {
        try {
            res.json({
                success: true,
                nodes: resourceSvc.evaluateEfficiency(),
                costs: costSvc.getMonthlyBurn(),
                savings: costSvc.calculateProjectedSavings(),
                breakdown: costSvc.getBreakdown()
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * GET /api/resource/recommendations
     */
    async getRecommendations(req, res) {
        try {
            res.json({ success: true, recommendations: resourceSvc.getRecommendations() });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/resource/optimize
     */
    async applyOptimization(req, res) {
        try {
            const { nodeId, targetType } = req.body;
            // Simulated application of optimization
            resourceSvc.updateNode(nodeId, { type: targetType, status: 'optimized', cpu: 55, mem: 60 });

            res.json({
                success: true,
                message: `Resizing request for ${nodeId} to ${targetType} submitted to orchestration layer.`,
                impact: 'ESTIMATED_45%_COST_REDUCTION_ON_NODE'
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new ResourceController();
