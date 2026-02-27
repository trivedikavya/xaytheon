/**
 * XAYTHEON — Impact Propagation Service
 * Recursively calculates the blast radius of a code change.
 */

const codeGraph = require('./code-graph.service');

class ImpactPropagationService {
    /**
     * Calculate Blast Radius
     * Nodes affected by a change in targetNodeId
     */
    calculateBlastRadius(targetNodeId) {
        const impactSet = new Set();
        const queue = [targetNodeId];
        const visited = new Set();

        // We need to trace UPSTREAM (who depends on me?)
        // So we build a reverse map temporarily
        const reverseEdges = {};
        codeGraph.edges.forEach(e => {
            if (!reverseEdges[e.to]) reverseEdges[e.to] = [];
            reverseEdges[e.to].push(e.from);
        });

        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) continue;
            visited.add(current);

            const upstreams = reverseEdges[current] || [];
            upstreams.forEach(up => {
                impactSet.add(up);
                queue.push(up);
            });
        }

        return {
            source: targetNodeId,
            impactedNodes: Array.from(impactSet),
            riskScore: this._calculateRisk(impactSet.size)
        };
    }

    _calculateRisk(impactSize) {
        if (impactSize > 5) return 'CRITICAL';
        if (impactSize > 2) return 'HIGH';
        return 'MODERATE';
    }

    /**
     * Simulate Change Impact
     */
    simulateChange(nodeId, linesChanged) {
        const radius = this.calculateBlastRadius(nodeId);
        return {
            ...radius,
            linesAffectedEstimated: linesChanged * (radius.impactedNodes.length + 1) * 0.4,
            recommendation: radius.riskScore === 'CRITICAL' ? 'Senior Review Required' : 'Standard PR'
        };
    }
}

module.exports = new ImpactPropagationService();
