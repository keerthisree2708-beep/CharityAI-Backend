const express = require('express');
const { getNearbyNgos, createDonation, getMyDonations, getDonationTracking } = require('../controllers/donorController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/nearby-ngos', getNearbyNgos);
router.get('/my-history', protect, authorize('donor'), getMyDonations);
router.get('/ai-match', protect, authorize('donor'), require('../controllers/donorController').getAiMatch);
router.post('/donations', protect, authorize('donor'), upload.array('images', 3), createDonation);
router.get('/:id/tracking', protect, getDonationTracking);

module.exports = router;
