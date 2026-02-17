const riskService = require('../services/risk-detector.service');
const riskEngine = require('../services/risk-engine.service');

exports.getAnalysis = async (req, res) => {
    try {
        const { repo } = req.query;
        if (!repo) return res.status(400).json({ message: "Repo is required" });

        const data = await riskService.analyzeConflicts(repo);
        res.json(data);
    } catch (error) {
        console.error("Risk Analysis Error:", error);
        res.status(500).json({ message: "Failed to perform risk analysis" });
    }
};

exports.getRiskGalaxy = async (req, res) => {
    try {
        const galaxyData = await riskEngine.calculateRiskGalaxy();
        res.json({
            success: true,
            data: galaxyData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPredictiveAnalysis = async (req, res) => {
    const { fileId } = req.params;
    try {
        const galaxyData = await riskEngine.calculateRiskGalaxy();
        const fileData = galaxyData.find(f => f.id == fileId);

        if (!fileData) return res.status(404).json({ message: "File not found" });

        res.json({
            success: true,
            data: {
                ...fileData,
                prediction: "High likelihood of regression if complexity is not reduced.",
                recommendation: "Target for refactoring in next sprint."
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * BLAST-RADIUS API ENDPOINT
 * Calculates vulnerability propagation impact across dependency tree
 */
exports.getBlastRadius = async (req, res) => {
    const { vulnerabilityNode } = req.query;

    try {
        if (!vulnerabilityNode) {
            return res.status(400).json({
                success: false,
                message: 'vulnerabilityNode parameter is required'
            });
        }

        // Get dependency tree (in production, fetch from real parser)
        const dependencyTree = riskEngine.getMockDependencyTree();

        // Calculate blast radius propagation
        const blastRadiusData = await riskEngine.calculateBlastRadius(
            vulnerabilityNode,
            dependencyTree
        );

        res.json({
            success: true,
            data: {
                ...blastRadiusData,
                timestamp: new Date().toISOString(),
                analysisType: 'AI-Driven Blast Radius Analysis'
            }
        });
    } catch (error) {
        console.error('Blast Radius Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

