const archDependencyParser = require("../services/arch-dependency-parser.service");
const violationDetector = require("../services/violation-detector.service");
const aiGovernance = require("../services/ai-governance.service");
const architectureValidator = require("../services/architecture-validator.service");

/**
 * Architectural Drift Detector Controller
 * Handles all routes for architectural analysis and violations
 */

class ArchDriftController {
  /**
   * Parse repository dependencies
   * GET /api/arch-drift/parse/:owner/:repo
   */
  async parseRepository(req, res) {
    try {
      const { owner, repo } = req.params;

      if (!owner || !repo) {
        return res.status(400).json({ error: "Owner and repo are required" });
      }

      const result = await archDependencyParser.parseRepository(owner, repo);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error parsing repository:", error);
      res.status(500).json({
        error: "Failed to parse repository",
        message: error.message,
      });
    }
  }

  /**
   * Detect architectural violations
   * GET /api/arch-drift/violations/:owner/:repo
   */
  async detectViolations(req, res) {
    try {
      const { owner, repo } = req.params;
      const { architecture = "layered" } = req.query;

      if (!owner || !repo) {
        return res.status(400).json({ error: "Owner and repo are required" });
      }

      const result = await violationDetector.detectViolations(owner, repo, architecture);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error detecting violations:", error);
      res.status(500).json({
        error: "Failed to detect violations",
        message: error.message,
      });
    }
  }

  /**
   * Get heatmap data for 3D visualization
   * GET /api/arch-drift/heatmap/:owner/:repo
   */
  async getHeatmap(req, res) {
    try {
      const { owner, repo } = req.params;
      const { architecture = "layered" } = req.query;

      const violations = await violationDetector.detectViolations(owner, repo, architecture);

      res.json({
        success: true,
        data: violations.heatmap,
        metrics: violations.metrics,
      });
    } catch (error) {
      console.error("Error generating heatmap:", error);
      res.status(500).json({
        error: "Failed to generate heatmap",
        message: error.message,
      });
    }
  }

  /**
   * Explain a specific violation
   * POST /api/arch-drift/explain
   */
  async explainViolation(req, res) {
    try {
      const { violation, architecture } = req.body;

      if (!violation) {
        return res.status(400).json({ error: "Violation data is required" });
      }

      const explanation = aiGovernance.explainViolation(violation, architecture || "Layered Architecture");

      res.json({
        success: true,
        data: explanation,
      });
    } catch (error) {
      console.error("Error explaining violation:", error);
      res.status(500).json({
        error: "Failed to explain violation",
        message: error.message,
      });
    }
  }

  /**
   * Generate boilerplate code to fix violation
   * POST /api/arch-drift/generate-code
   */
  async generateCode(req, res) {
    try {
      const { violation, language = "javascript" } = req.body;

      if (!violation) {
        return res.status(400).json({ error: "Violation data is required" });
      }

      const code = aiGovernance.generateBoilerplateCode(violation, language);

      if (!code) {
        return res.status(404).json({
          error: "Could not generate code for this violation type",
        });
      }

      res.json({
        success: true,
        data: code,
      });
    } catch (error) {
      console.error("Error generating code:", error);
      res.status(500).json({
        error: "Failed to generate code",
        message: error.message,
      });
    }
  }

  /**
   * Get AI recommendations
   * GET /api/arch-drift/recommendations/:owner/:repo
   */
  async getRecommendations(req, res) {
    try {
      const { owner, repo } = req.params;
      const { architecture = "layered" } = req.query;

      const violations = await violationDetector.detectViolations(owner, repo, architecture);
      const recommendations = aiGovernance.generateRecommendations(violations.violations);

      res.json({
        success: true,
        data: recommendations,
        summary: violations.metrics,
      });
    } catch (error) {
      console.error("Error getting recommendations:", error);
      res.status(500).json({
        error: "Failed to get recommendations",
        message: error.message,
      });
    }
  }

  /**
   * Validate architecture against definition
   * POST /api/arch-drift/validate
   */
  async validateArchitecture(req, res) {
    try {
      const { owner, repo, definition } = req.body;

      if (!owner || !repo || !definition) {
        return res.status(400).json({
          error: "Owner, repo, and architecture definition are required",
        });
      }

      const report = await architectureValidator.validateArchitecture(owner, repo, definition);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error("Error validating architecture:", error);
      res.status(500).json({
        error: "Failed to validate architecture",
        message: error.message,
      });
    }
  }

  /**
   * Get example architecture definitions
   * GET /api/arch-drift/examples
   */
  async getExamples(req, res) {
    try {
      const examples = architectureValidator.getExampleDefinitions();

      res.json({
        success: true,
        data: examples,
      });
    } catch (error) {
      console.error("Error getting examples:", error);
      res.status(500).json({
        error: "Failed to get examples",
        message: error.message,
      });
    }
  }

  /**
   * Get supported architecture patterns
   * GET /api/arch-drift/patterns
   */
  async getPatterns(req, res) {
    try {
      const patterns = [
        {
          id: "mvc",
          name: "Model-View-Controller (MVC)",
          description: "Classic web application pattern with three main layers",
          layers: ["view", "controller", "model"],
        },
        {
          id: "cleanArchitecture",
          name: "Clean Architecture",
          description: "Dependency rule: outer layers depend on inner, never the reverse",
          layers: ["view", "controller", "service", "model"],
        },
        {
          id: "hexagonal",
          name: "Hexagonal Architecture (Ports & Adapters)",
          description: "Application core surrounded by adapters",
          layers: ["controller", "service", "model"],
        },
        {
          id: "layered",
          name: "Layered Architecture",
          description: "Traditional N-tier architecture with strict layer separation",
          layers: ["view", "controller", "service", "model", "utils"],
        },
      ];

      res.json({
        success: true,
        data: patterns,
      });
    } catch (error) {
      console.error("Error getting patterns:", error);
      res.status(500).json({
        error: "Failed to get patterns",
        message: error.message,
      });
    }
  }
}

module.exports = new ArchDriftController();
