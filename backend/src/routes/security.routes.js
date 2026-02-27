const express = require('express');
const router = express.Router();
const securityController = require('../controllers/security.controller');

router.post('/scan', securityController.startScan);
router.get('/history', securityController.getHistory);
router.post('/apply-patch', securityController.applyPatch);

module.exports = router;
