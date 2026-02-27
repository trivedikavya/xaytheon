/**
 * XAYTHEON — Traffic Analysis Service
 * Logic for evaluating service mesh health and calculating optimal traffic weights.
 */

class TrafficAnalysisService {
    constructor() {
        this.nodes = [
            { id: 'auth-svc', name: 'Auth Service', latency: 12, errorRate: 0.01, load: 45, capacity: 1000, status: 'healthy' },
            { id: 'api-gtw', name: 'API Gateway', latency: 24, errorRate: 0.02, load: 120, capacity: 5000, status: 'healthy' },
            { id: 'db-node-1', name: 'Primary DB', latency: 5, errorRate: 0.00, load: 60, capacity: 8000, status: 'healthy' },
            { id: 'cache-l1', name: 'Redis Cache', latency: 1, errorRate: 0.05, load: 85, capacity: 10000, status: 'healthy' },
            { id: 'pay-svc', name: 'Payment Service', latency: 45, errorRate: 0.12, load: 30, capacity: 500, status: 'warning' },
            { id: 'notif-svc', name: 'Notify Service', latency: 8, errorRate: 0.01, load: 15, capacity: 2000, status: 'healthy' }
        ];
    }

    /**
     * Compute "Health Score" (0-100) for a node based on latency, error rate, and load.
     */
    computeNodeScore(node) {
        let score = 100;

        // Latency penalty: -1 point for every 5ms above 20ms
        if (node.latency > 20) {
            score -= Math.floor((node.latency - 20) / 5);
        }

        // Error rate penalty: exponential
        if (node.errorRate > 0) {
            score -= (node.errorRate * 400); // 10% error = -40 points
        }

        // Load penalty: -1 point for every 2% above 80%
        const loadRatio = (node.load / node.capacity) * 100;
        if (loadRatio > 80) {
            score -= Math.floor((loadRatio - 80) / 2);
        }

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Get Mesh Topology Status
     */
    getGraphStatus() {
        return this.nodes.map(node => {
            const score = this.computeNodeScore(node);
            return {
                ...node,
                healthScore: score,
                status: score > 85 ? 'healthy' : score > 50 ? 'warning' : 'critical'
            };
        });
    }

    /**
     * Suggest Traffic Weight Redistibution
     */
    calculateRerouting(targetNodeId) {
        const mesh = this.getGraphStatus();
        const target = mesh.find(n => n.id === targetNodeId);

        if (!target || target.status === 'healthy') {
            return { rerouted: false, message: 'Node is healthy or not found.' };
        }

        // Find healthy alternatives (simplified logic)
        const healthyNodes = mesh.filter(n => n.id !== targetNodeId && n.status === 'healthy');
        if (healthyNodes.length === 0) {
            return { rerouted: false, error: 'No healthy failover nodes available' };
        }

        // Distribute load to top 2 healthy nodes
        const sorted = healthyNodes.sort((a, b) => b.healthScore - a.healthScore);
        const failovers = sorted.slice(0, 2);

        const shiftAmount = Math.floor(target.load * 0.7); // Shift 70% of traffic
        const reassignments = failovers.map(node => ({
            from: targetNodeId,
            to: node.id,
            weightShift: Math.floor(shiftAmount / failovers.length),
            reason: `Failover: ${target.name} is in ${target.status} state`
        }));

        return {
            rerouted: true,
            originalNode: targetNodeId,
            status: target.status,
            reassignments,
            newTopology: mesh.map(n => {
                if (n.id === targetNodeId) n.load -= shiftAmount;
                const re = reassignments.find(r => r.to === n.id);
                if (re) n.load += re.weightShift;
                return n;
            })
        };
    }

    /**
     * Simulate realtime drift
     */
    simulateDrift() {
        this.nodes.forEach(node => {
            // Random fluctuations
            node.latency += (Math.random() * 4 - 2);
            node.load += (Math.random() * 20 - 10);
            node.errorRate = Math.max(0, node.errorRate + (Math.random() * 0.02 - 0.01));

            // Clean up
            node.latency = Math.max(1, parseFloat(node.latency.toFixed(1)));
            node.load = Math.max(0, Math.round(node.load));
            node.errorRate = parseFloat(node.errorRate.toFixed(3));
        });
    }
}

module.exports = new TrafficAnalysisService();
