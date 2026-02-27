const express = require('express');
const router = express.Router();
const graphController = require('../controllers/graph.controller');

router.get('/topology', graphController.getTopology);
router.post('/analyze', graphController.analyzeImpact);
router.get('/linchpins', graphController.findCriticalNodes);

module.exports = router;
