const User = require('../models/User');
const Donation = require('../models/Donation');
const { sendResponse } = require('../utils/helpers');

// @desc    Get pending NGOs
// @route   GET /api/admin/ngos/pending
// @access  Private (Admin)
exports.getPendingNgos = async (req, res, next) => {
  try {
    const ngos = await User.find({ role: 'ngo', approvalStatus: 'pending' });
    sendResponse(res, 200, true, ngos);
  } catch (error) {
    next(error);
  }
};

// @desc    Approve or reject NGO
// @route   PUT /api/admin/ngos/:id/approve
// @access  Private (Admin)
exports.approveNgo = async (req, res, next) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    
    if (!['approved', 'rejected'].includes(status)) {
      return sendResponse(res, 400, false, null, 'Invalid status');
    }

    const ngo = await User.findByIdAndUpdate(
      req.params.id,
      { approvalStatus: status },
      { new: true, runValidators: true }
    );

    if (!ngo) {
      return sendResponse(res, 404, false, null, 'NGO not found');
    }

    sendResponse(res, 200, true, ngo, `NGO ${status} successfully`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get Admin Stats
// @route   GET /api/admin/stats
// @access  Private (Admin)
exports.getStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeNgos = await User.countDocuments({ role: 'ngo', approvalStatus: 'approved' });
    const totalDonations = await Donation.countDocuments();
    
    const stats = [
      { v: totalUsers.toString(), l: "Total Users", c: "#2563EB", bg: "#0A1628" },
      { v: activeNgos.toString(), l: "Active NGOs", c: "#4ADE80", bg: "#0A2A14" },
      { v: totalDonations.toString(), l: "Total Donations", c: "#A78BFA", bg: "#1A0A2A" },
      { v: "7", l: "Fraud Alerts", c: "#FCA5A5", bg: "#2A0A0A" },
    ];
    
    sendResponse(res, 200, true, stats);
  } catch (error) {
    next(error);
  }
};

// @desc    Get Fraud Alerts
// @route   GET /api/admin/fraud
// @access  Private (Admin)
exports.getFraudAlerts = async (req, res, next) => {
  try {
    const alerts = [];
    
    const ngos = await User.find({ role: 'ngo', approvalStatus: 'approved' });
    for (const ngo of ngos) {
      const donationCount = await Donation.countDocuments({ assignedNgoId: ngo._id, status: 'delivered' });
      // If they claim they help 500+ people but have < 2 delivered donations, flag it.
      if (ngo.ngoDetails?.beneficiaries > 500 && donationCount < 2) {
        alerts.push({
          id: `F-${ngo._id.toString().substring(0, 5)}`,
          type: "Suspicious Activity",
          entity: ngo.name,
          issue: `Claims ${ngo.ngoDetails.beneficiaries} beneficiaries but only has ${donationCount} delivered donations.`,
          risk: "High",
          color: "#DC2626"
        });
      }
    }

    // Check 2: Unverified NGOs that haven't uploaded documents
    const pendingNgos = await User.find({ role: 'ngo', approvalStatus: 'pending' });
    for (const ngo of pendingNgos) {
      if (!ngo.ngoDetails?.documents || ngo.ngoDetails.documents.length === 0) {
        alerts.push({
          id: `D-${ngo._id.toString().substring(0, 5)}`,
          type: "Missing Documents",
          entity: ngo.name,
          issue: "NGO registered but no verification documents uploaded.",
          risk: "Medium",
          color: "#F59E0B"
        });
      }
    }

    sendResponse(res, 200, true, alerts);
  } catch (error) {
    next(error);
  }
};
