const Requirement = require('../models/Requirement');
const Donation = require('../models/Donation');
const Tracking = require('../models/Tracking');
const { sendResponse } = require('../utils/helpers');
const { requirementValidation } = require('../validations');

// @desc    Get NGO dashboard stats (real DB data)
// @route   GET /api/ngo/dashboard
// @access  Private (NGO)
exports.getDashboard = async (req, res, next) => {
  try {
    const ngoId = req.user.id;

    // Real DB queries
    const totalDonations = await Donation.countDocuments({ assignedNgoId: ngoId });
    const pendingDonations = await Donation.countDocuments({ assignedNgoId: ngoId, status: 'pending' });
    const deliveredDonations = await Donation.countDocuments({ assignedNgoId: ngoId, status: 'delivered' });

    // Latest 5 pending donation requests
    const requests = await Donation.find({ assignedNgoId: ngoId, status: 'pending' })
      .populate('donorId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(5);

    const stats = [
      { v: totalDonations.toString(), l: 'Total Donations', color: '#2563EB', bg: '#1A2657' },
      { v: pendingDonations.toString(), l: 'Pending', color: '#F59E0B', bg: '#2A2005' },
      { v: deliveredDonations.toString(), l: 'Delivered', color: '#4ADE80', bg: '#0A2A14' },
      { v: totalDonations > 0 ? `${Math.round((deliveredDonations / totalDonations) * 100)}%` : '0%', l: 'Success Rate', color: '#4ADE80', bg: '#0A2A14' },
    ];

    sendResponse(res, 200, true, { stats, requests });
  } catch (error) {
    next(error);
  }
};

// @desc    Get NGO requirements
// @route   GET /api/ngo/requirements
// @access  Public or Private
exports.getRequirements = async (req, res, next) => {
  try {
    const filter = req.user && req.user.role === 'ngo' ? { ngoId: req.user.id } : {};
    const requirements = await Requirement.find(filter).populate('ngoId', 'name email address');
    sendResponse(res, 200, true, requirements);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a requirement
// @route   POST /api/ngo/requirements
// @access  Private (NGO)
exports.createRequirement = async (req, res, next) => {
  try {
    // Validate incoming request body
    const { error } = requirementValidation(req.body);
    if (error) {
      return sendResponse(res, 400, false, null, error.details[0].message);
    }

    const { category, description, quantity, urgency, needByDate } = req.body;

    const requirement = await Requirement.create({
      ngoId: req.user.id,
      category,
      description,
      quantity: quantity || 'Not specified',
      urgency: urgency || 'medium',
      needByDate: needByDate ? new Date(needByDate) : undefined,
    });

    sendResponse(res, 201, true, requirement, 'Requirement created successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Update donation status
// @route   PUT /api/ngo/donations/:id/status
// @access  Private (NGO)
exports.updateDonationStatus = async (req, res, next) => {
  try {
    const { status, note, longitude, latitude } = req.body;

    // Validate status value
    const validStatuses = ['pending', 'accepted', 'in_transit', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return sendResponse(res, 400, false, null, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    let donation = await Donation.findById(req.params.id);
    if (!donation) {
      return sendResponse(res, 404, false, null, 'Donation not found');
    }

    // Verify this NGO is assigned to this donation
    if (!donation.assignedNgoId || donation.assignedNgoId.toString() !== req.user.id) {
      return sendResponse(res, 403, false, null, 'Not authorized to update this donation');
    }

    donation.status = status;
    await donation.save();

    // Update tracking
    const trackingUpdate = {
      status,
      note: note || `Status updated to ${status}`,
    };

    if (longitude && latitude) {
      trackingUpdate.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      };
    }

    await Tracking.findOneAndUpdate(
      { donationId: donation._id },
      { $push: { timeline: trackingUpdate } }
    );

    // Emit socket event for real-time tracking
    const io = req.app.get('io');
    if (io) {
      io.to(donation._id.toString()).emit('tracking-update', trackingUpdate);
    }

    sendResponse(res, 200, true, donation, 'Status updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Upload NGO Documents
// @route   POST /api/ngo/upload-docs
// @access  Private (NGO)
exports.uploadDocs = async (req, res, next) => {
  try {
    const documents = req.files ? req.files.map(file => file.path || file.filename) : [];
    
    if (documents.length === 0) {
      return sendResponse(res, 400, false, null, 'No documents uploaded');
    }

    const user = await require('../models/User').findById(req.user.id);
    
    // Append to existing docs or create new array
    if (!user.ngoDetails) user.ngoDetails = {};
    if (!user.ngoDetails.documents) user.ngoDetails.documents = [];
    user.ngoDetails.documents.push(...documents);

    await user.save();

    sendResponse(res, 200, true, documents, 'Documents uploaded successfully');
  } catch (error) {
    next(error);
  }
};
