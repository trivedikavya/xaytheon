/**
 * XAYTHEON — Graph Controller
 */

const codeGraph = require('../services/code-graph.service');
const impactSvc = require('../services/impact-propagation.service');

class GraphController {
    /**
     * GET /api/graph/topology
     */
    async getTopology(req, res) {
        try {
            res.json({ success: true, graph: codeGraph.getGraph() });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/graph/analyze-impact
     */
    async analyzeImpact(req, res) {
        try {
            const { nodeId, linesChanged = 50 } = req.body;
            if (!nodeId) return res.status(400).json({ success: false, message: 'nodeId is required' });

            const analysis = impactSvc.simulateChange(nodeId, linesChanged);
            res.json({ success: true, analysis });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * GET /api/graph/linchpins
     */
    async findCriticalNodes(req, res) {
        try {
            const allNodes = Array.from(codeGraph.nodes.keys());
            const impacts = allNodes.map(id => {
                const b = impactSvc.calculateBlastRadius(id);
                return { id, impactSize: b.impactedNodes.length, risk: b.riskScore };
            });

            res.json({ success: true, linchpins: impacts.sort((a, b) => b.impactSize - a.impactSize) });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new GraphController();
