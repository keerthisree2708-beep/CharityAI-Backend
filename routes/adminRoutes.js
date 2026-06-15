const express = require('express');
const { getPendingNgos, approveNgo } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/ngos/pending', getPendingNgos);
router.put('/ngos/:id/approve', approveNgo);
router.get('/stats', require('../controllers/adminController').getStats);
router.get('/fraud', require('../controllers/adminController').getFraudAlerts);

module.exports = router;
