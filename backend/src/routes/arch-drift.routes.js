const express = require("express");
const router = express.Router();
const archDriftController = require("../controllers/arch-drift.controller");

/**
 * Architectural Drift Detector Routes
 */

// Parse repository dependencies
router.get("/parse/:owner/:repo", archDriftController.parseRepository);

// Detect architectural violations
router.get("/violations/:owner/:repo", archDriftController.detectViolations);

// Get heatmap data for 3D visualization
router.get("/heatmap/:owner/:repo", archDriftController.getHeatmap);

// Explain specific violation (AI Governance)
router.post("/explain", archDriftController.explainViolation);

// Generate boilerplate code to fix violation
router.post("/generate-code", archDriftController.generateCode);

// Get AI recommendations
router.get("/recommendations/:owner/:repo", archDriftController.getRecommendations);

// Validate architecture against definition (Architecture-as-Code)
router.post("/validate", archDriftController.validateArchitecture);

// Get example architecture definitions
router.get("/examples", archDriftController.getExamples);

// Get supported architecture patterns
router.get("/patterns", archDriftController.getPatterns);

module.exports = router;
