const express = require('express');
const { getRequirements, createRequirement, updateDonationStatus, uploadDocs } = require('../controllers/ngoController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/requirements', optionalAuth, getRequirements); // Public or customized for NGO in controller

router.use(protect);
router.use(authorize('ngo'));

router.get('/dashboard', require('../controllers/ngoController').getDashboard);
router.post('/requirements', createRequirement);
router.put('/donations/:id/status', updateDonationStatus);
router.patch('/donations/:id', updateDonationStatus);
router.post('/upload-docs', upload.array('documents', 5), uploadDocs);

module.exports = router;
