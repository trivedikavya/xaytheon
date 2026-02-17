/**
 * Risk Engine Service
 * Predicts bug propensity using code churn, expertise debt, and historical data.
 */
class RiskEngineService {
    /**
     * Calculates risk scores for all project files.
     */
    async calculateRiskGalaxy() {
        const files = this.getMockFileHistory();

        return files.map(file => {
            const churnScore = this.calculateChurnScore(file.history);
            const expertiseDebt = this.calculateExpertiseDebt(file.authors);
            const complexityScore = file.complexity * 0.4;

            // Final Fragility Score (0-100)
            const fragilityScore = Math.min(100, (churnScore * 0.4) + (expertiseDebt * 0.3) + (complexityScore));

            return {
                id: file.id,
                name: file.name,
                path: file.path,
                score: parseFloat(fragilityScore.toFixed(2)),
                metrics: {
                    churn: churnScore,
                    expertise: expertiseDebt,
                    complexity: file.complexity,
                    historicalBugs: file.historicalBugs
                },
                trend: this.generateTimeline(fragilityScore),
                status: this.getStatus(fragilityScore)
            };
        });
    }

    calculateChurnScore(history) {
        // High frequency of changes in last 30 days = higher churn
        const recentChanges = history.filter(h => h.daysAgo <= 30).length;
        return Math.min(100, recentChanges * 10);
    }

    calculateExpertiseDebt(authors) {
        // If a file has many authors but no clear "owner" (>50% contributions), debt is high
        const totalCommits = authors.reduce((a, b) => a + b.commits, 0);
        const maxCommits = Math.max(...authors.map(a => a.commits));
        const ownershipRatio = maxCommits / totalCommits;

        return Math.min(100, (1 - ownershipRatio) * 100);
    }

    getStatus(score) {
        if (score > 75) return 'CRITICAL';
        if (score > 50) return 'HIGH';
        if (score > 25) return 'MEDIUM';
        return 'LOW';
    }

    generateTimeline(currentScore) {
        // Generate mock historical data for the last 6 months
        const points = [];
        let base = currentScore;
        for (let i = 0; i < 6; i++) {
            points.push({
                month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
                value: Math.max(0, Math.min(100, base + (Math.random() * 20 - 10)))
            });
        }
        return points;
    }

    getMockFileHistory() {
        return [
            {
                id: 1, name: 'auth.service.js', path: 'src/services/auth.service.js', complexity: 85, historicalBugs: 12,
                history: Array.from({ length: 15 }, () => ({ daysAgo: Math.floor(Math.random() * 60) })),
                authors: [{ name: 'dev1', commits: 50 }, { name: 'dev2', commits: 45 }]
            },
            {
                id: 2, name: 'payment.gateway.js', path: 'src/integrations/payment.gateway.js', complexity: 92, historicalBugs: 8,
                history: Array.from({ length: 20 }, () => ({ daysAgo: Math.floor(Math.random() * 30) })),
                authors: [{ name: 'dev3', commits: 30 }, { name: 'dev4', commits: 28 }, { name: 'dev5', commits: 25 }]
            },
            {
                id: 3, name: 'utils.js', path: 'src/utils/utils.js', complexity: 20, historicalBugs: 1,
                history: [{ daysAgo: 45 }, { daysAgo: 100 }],
                authors: [{ name: 'dev1', commits: 80 }]
            },
            {
                id: 4, name: 'socket.server.js', path: 'src/socket/socket.server.js', complexity: 70, historicalBugs: 5,
                history: Array.from({ length: 12 }, () => ({ daysAgo: Math.floor(Math.random() * 40) })),
                authors: [{ name: 'dev2', commits: 40 }, { name: 'dev6', commits: 10 }]
            },
            {
                id: 5, name: 'db.config.js', path: 'src/config/db.js', complexity: 15, historicalBugs: 0,
                history: [{ daysAgo: 200 }],
                authors: [{ name: 'dev1', commits: 100 }]
            }
        ];
    }

    /**
     * BLAST-RADIUS VULNERABILITY PROPAGATION ENGINE
     * Recursively calculates the impact of a vulnerability across the dependency tree
     */
    async calculateBlastRadius(vulnerabilityNode, dependencyTree) {
        const propagationMap = new Map();
        const visited = new Set();
        const criticalityScores = this.getCriticalityMatrix();

        // Recursive DFS traversal to map propagation
        const traverse = (nodeId, depth, parentImpact) => {
            if (visited.has(nodeId) || depth > 5) return; // Limit depth to prevent infinite loops
            visited.add(nodeId);

            const node = dependencyTree.nodes.find(n => n.id === nodeId);
            if (!node) return;

            // Calculate impact multiplier based on node criticality
            const criticality = criticalityScores[node.type] || 1.0;
            const depthDecay = Math.pow(0.7, depth); // Impact decreases with distance
            const impactScore = parentImpact * criticality * depthDecay;

            propagationMap.set(nodeId, {
                id: nodeId,
                name: node.name,
                type: node.type,
                impactScore: Math.min(100, impactScore),
                depth: depth,
                status: this.getPropagationStatus(impactScore),
                affectedServices: []
            });

            // Find all nodes that depend on this one
            const dependents = dependencyTree.links
                .filter(link => link.source === nodeId)
                .map(link => link.target);

            dependents.forEach(depId => {
                traverse(depId, depth + 1, impactScore);
                // Track affected services
                if (propagationMap.has(nodeId)) {
                    propagationMap.get(nodeId).affectedServices.push(depId);
                }
            });
        };

        // Start propagation from vulnerability source with 100% initial impact
        traverse(vulnerabilityNode, 0, 100);

        return {
            sourceVulnerability: vulnerabilityNode,
            totalAffectedNodes: propagationMap.size,
            propagationTree: Array.from(propagationMap.values()),
            riskLevel: this.calculateOverallRiskLevel(propagationMap),
            recommendation: this.generateRecommendation(propagationMap)
        };
    }

    getCriticalityMatrix() {
        return {
            'root': 1.0,
            'core': 0.95,
            'critical': 0.9,
            'dependency': 0.7,
            'data': 0.85,
            'service': 0.75,
            'cache': 0.5,
            'devDependency': 0.3,
            'ai': 0.8
        };
    }

    getPropagationStatus(impact) {
        if (impact > 75) return 'CRITICAL';
        if (impact > 50) return 'HIGH';
        if (impact > 25) return 'MODERATE';
        return 'LOW';
    }

    calculateOverallRiskLevel(propagationMap) {
        const criticalCount = Array.from(propagationMap.values())
            .filter(n => n.status === 'CRITICAL').length;
        const highCount = Array.from(propagationMap.values())
            .filter(n => n.status === 'HIGH').length;

        if (criticalCount > 3 || (criticalCount > 0 && highCount > 5)) {
            return 'SYSTEM_CRITICAL';
        } else if (criticalCount > 0 || highCount > 3) {
            return 'MODERATE_RISK';
        }
        return 'LOW_RISK';
    }

    generateRecommendation(propagationMap) {
        const totalNodes = propagationMap.size;
        const criticalNodes = Array.from(propagationMap.values())
            .filter(n => n.status === 'CRITICAL');

        if (totalNodes > 10) {
            return `URGENT: Vulnerability affects ${totalNodes} downstream services. Immediate patch required.`;
        } else if (criticalNodes.length > 0) {
            return `HIGH PRIORITY: ${criticalNodes.length} critical services compromised. Schedule emergency patch.`;
        }
        return `Monitor closely. ${totalNodes} services affected but impact is contained.`;
    }

    /**
     * Simulates a dependency tree for demonstration
     */
    getMockDependencyTree() {
        return {
            nodes: [
                { id: 'app-root', name: 'XAYTHEON App', type: 'root' },
                { id: 'express', name: 'express', type: 'dependency' },
                { id: 'socket.io', name: 'socket.io', type: 'critical' },
                { id: 'axios', name: 'axios', type: 'dependency' },
                { id: 'jsonwebtoken', name: 'jsonwebtoken', type: 'critical' },
                { id: 'cors', name: 'cors', type: 'dependency' },
                { id: 'auth-service', name: 'Auth Service', type: 'core' },
                { id: 'payment-service', name: 'Payment Service', type: 'critical' },
                { id: 'user-service', name: 'User Service', type: 'service' },
                { id: 'redis-cache', name: 'Redis Cache', type: 'cache' },
                { id: 'ai-engine', name: 'AI Engine', type: 'ai' }
            ],
            links: [
                { source: 'app-root', target: 'express' },
                { source: 'app-root', target: 'socket.io' },
                { source: 'app-root', target: 'axios' },
                { source: 'app-root', target: 'jsonwebtoken' },
                { source: 'express', target: 'auth-service' },
                { source: 'express', target: 'payment-service' },
                { source: 'express', target: 'user-service' },
                { source: 'socket.io', target: 'user-service' },
                { source: 'jsonwebtoken', target: 'auth-service' },
                { source: 'auth-service', target: 'user-service' },
                { source: 'auth-service', target: 'redis-cache' },
                { source: 'payment-service', target: 'ai-engine' },
                { source: 'user-service', target: 'redis-cache' }
            ]
        };
    }
}

module.exports = new RiskEngineService();
