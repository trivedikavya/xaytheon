/**
 * Diff Routes
 * Extended (Issue #618): Dependency Risk Propagation Engine
 */

const express = require('express');
const router = express.Router();
const DiffController = require('../controllers/diff.controller');

// Existing routes
router.get('/view', DiffController.getDiff.bind(DiffController));
router.get('/patch/:patchId', DiffController.getPatchDiff.bind(DiffController));
router.post('/apply', DiffController.applyPatch.bind(DiffController));

router.get('/compare', async (req, res) => {
    try {
        const { filePath, original, refactored } = req.query;
        if (!filePath || !original || !refactored) {
            return res.status(400).json({ error: 'filePath, original, and refactored parameters required' });
        }
        const diff = require('diff');
        const patch = diff.createPatch(filePath, original, refactored, 'original', 'refactored');
        const diffData = DiffController.parsePatchToDiff({ filePath, description: 'Custom comparison', type: 'comparison', severity: 'info', patch });
        res.json(diffData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate comparison diff' });
    }
});

// Issue #618 — Dependency Risk Propagation Engine
// Full cross-repo BFS propagation map for a vulnerable package
router.post('/propagation-map', DiffController.getPropagationMap.bind(DiffController));

// Blast-radius ranked exploit chains with D3-ready graph export
router.post('/blast-radius', DiffController.getBlastRadius.bind(DiffController));

module.exports = router;
