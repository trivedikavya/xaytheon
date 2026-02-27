/**
 * XAYTHEON — Traffic Mesh Controller
 */

const trafficService = require('../services/traffic-analysis.service');
const meshAnalyzer = require('../services/mesh-analyzer.service');

class TrafficController {
    /**
     * GET /api/traffic/mesh
     */
    async getMeshStatus(req, res) {
        try {
            trafficService.simulateDrift();
            const mesh = trafficService.getGraphStatus();
            const cascading = meshAnalyzer.detectCascading(mesh);
            const linchpins = meshAnalyzer.findLinchpins();

            res.json({
                success: true,
                data: {
                    nodes: mesh,
                    cascadingFailures: cascading,
                    linchpins,
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/traffic/reroute
     */
    async triggerReroute(req, res) {
        try {
            const { nodeId } = req.body;
            if (!nodeId) return res.status(400).json({ success: false, message: 'nodeId required' });

            const result = trafficService.calculateRerouting(nodeId);

            // Calculate blast radius for the response
            const radius = meshAnalyzer.calculateBlastRadius(nodeId);

            res.json({
                success: true,
                data: {
                    ...result,
                    affectedUpstreams: radius
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * GET /api/traffic/blast-radius/:id
     */
    async getBlastRadius(req, res) {
        try {
            const radius = meshAnalyzer.calculateBlastRadius(req.params.id);
            res.json({ success: true, nodeId: req.params.id, impactedNodes: radius });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/traffic/simulate-failure
     */
    async simulateFailure(req, res) {
        try {
            const { nodeId, severity } = req.body;
            const node = trafficService.nodes.find(n => n.id === nodeId);

            if (node) {
                if (severity === 'high') {
                    node.latency += 200;
                    node.errorRate = 0.85;
                } else {
                    node.latency += 50;
                    node.errorRate = 0.25;
                }
                node.load = Math.round(node.capacity * 1.2);
            }

            res.json({ success: true, message: `Failure injected into ${nodeId}`, node });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new TrafficController();
