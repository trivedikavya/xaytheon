/**
 * XAYTHEON — Mesh Analyzer Service
 * Detects complex bottleneck patterns and blast-radius for service failures.
 */

class MeshAnalyzerService {
    constructor() {
        // Dependency map: which service depends on which
        this.dependencies = {
            'api-gtw': ['auth-svc', 'pay-svc', 'notif-svc'],
            'auth-svc': ['db-node-1', 'cache-l1'],
            'pay-svc': ['db-node-1'],
            'notif-svc': ['cache-l1']
        };
    }

    /**
     * Calculate Blast Radius of a node failure.
     * Identifies upstream services that will break if this node fails.
     */
    calculateBlastRadius(failedNodeId) {
        const affected = new Set();
        const queue = [failedNodeId];

        const upstreamMap = {};
        Object.entries(this.dependencies).forEach(([parent, deps]) => {
            deps.forEach(dep => {
                if (!upstreamMap[dep]) upstreamMap[dep] = [];
                upstreamMap[dep].push(parent);
            });
        });

        const visited = new Set();
        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) continue;
            visited.add(current);

            const upstreams = upstreamMap[current] || [];
            upstreams.forEach(up => {
                affected.add(up);
                queue.push(up);
            });
        }

        return Array.from(affected);
    }

    /**
     * Detect Cascading Failures
     * Checks if a warning in one node is causing degradation in its consumers.
     */
    detectCascading(meshData) {
        const regressions = [];

        Object.entries(this.dependencies).forEach(([parent, deps]) => {
            const parentNode = meshData.find(n => n.id === parent);
            if (!parentNode) return;

            deps.forEach(depId => {
                const depNode = meshData.find(n => n.id === depId);
                if (!depNode) return;

                // Pattern: Dep is warning/critical AND Parent latency is spiked > 50% relative to dep latency
                if (depNode.healthScore < 70 && parentNode.latency > depNode.latency * 1.5) {
                    regressions.push({
                        bottleneck: depId,
                        consumer: parent,
                        impact: 'latency_spillover',
                        severity: depNode.healthScore < 40 ? 'CRITICAL' : 'HIGH'
                    });
                }
            });
        });

        return regressions;
    }

    /**
     * Identify "Linchpin" Nodes
     * Nodes that, if they fail, have the largest blast radius.
     */
    findLinchpins() {
        const allNodes = new Set([...Object.keys(this.dependencies), ...Object.values(this.dependencies).flat()]);
        const rankings = Array.from(allNodes).map(id => {
            const radius = this.calculateBlastRadius(id);
            return { id, radiusSize: radius.length, impacted: radius };
        });

        return rankings.sort((a, b) => b.radiusSize - a.radiusSize);
    }
}

module.exports = new MeshAnalyzerService();
