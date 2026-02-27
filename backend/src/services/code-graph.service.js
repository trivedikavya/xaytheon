/**
 * XAYTHEON — Code Graph Service
 * Maps relationships between services, controllers, and utilities.
 */

class CodeGraphService {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
        this._initGraph();
    }

    _initGraph() {
        // Mock seed nodes
        this.addNode('auth-svc', 'service');
        this.addNode('user-ctrl', 'controller');
        this.addNode('db-connector', 'util');
        this.addNode('logger-lib', 'util');
        this.addNode('api-gateway', 'entry');

        // Edges: source -> target
        this.addEdge('api-gateway', 'auth-svc');
        this.addEdge('auth-svc', 'user-ctrl');
        this.addEdge('user-ctrl', 'db-connector');
        this.addEdge('auth-svc', 'logger-lib');
        this.addEdge('db-connector', 'logger-lib');
    }

    addNode(id, type) {
        this.nodes.set(id, { id, type, metadata: { lastChanged: Date.now() } });
    }

    addEdge(from, to) {
        this.edges.push({ from, to });
    }

    getGraph() {
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges
        };
    }

    getNodeNeighbors(nodeId) {
        return this.edges
            .filter(e => e.from === nodeId)
            .map(e => this.nodes.get(e.to));
    }
}

module.exports = new CodeGraphService();
