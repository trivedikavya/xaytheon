/**
 * XAYTHEON — Resource Optimization Service
 * Analyzes CPU/Mem usage to identify waste and suggest right-sizing.
 */

class ResourceOptimizationService {
    constructor() {
        this.nodes = [
            { id: 'node-us-east-1', type: 't3.large', cpu: 15, mem: 40, cost: 82, status: 'underutilized' },
            { id: 'node-us-east-2', type: 'm5.xlarge', cpu: 75, mem: 65, cost: 210, status: 'optimized' },
            { id: 'node-eu-west-1', type: 'c5.2xlarge', cpu: 8, mem: 12, cost: 340, status: 'wasteful' },
            { id: 'node-ap-south-1', type: 't3.medium', cpu: 92, mem: 88, cost: 41, status: 'bottleneck' }
        ];
    }

    /**
     * Compute Efficiency Score for each node
     */
    evaluateEfficiency() {
        return this.nodes.map(node => {
            const utilization = (node.cpu + node.mem) / 2;
            let score = 100;

            // Penalty for underutilization (waste)
            if (utilization < 20) score = 40;
            // Penalty for overutilization (risk)
            else if (utilization > 85) score = 60;
            // Best sweet spot: 40% - 70%
            else if (utilization >= 40 && utilization <= 70) score = 95;

            return { ...node, efficiencyScore: score };
        });
    }

    /**
     * Propose Right-Sizing
     */
    getRecommendations() {
        return this.nodes.filter(n => n.status === 'underutilized' || n.status === 'wasteful').map(n => ({
            nodeId: n.id,
            currentType: n.type,
            suggestedType: n.type.includes('large') ? n.type.replace('large', 'medium') : 't3.small',
            potentialSavings: n.cost * 0.45,
            reason: n.status === 'wasteful' ? 'Extreme low utilization detected' : 'Underutilized capacity'
        }));
    }

    updateNode(id, updates) {
        const n = this.nodes.find(node => node.id === id);
        if (n) Object.assign(n, updates);
    }
}

module.exports = new ResourceOptimizationService();
