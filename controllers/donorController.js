const Donation = require('../models/Donation');
const User = require('../models/User');
const Tracking = require('../models/Tracking');
const { sendResponse } = require('../utils/helpers');
const { donationValidation } = require('../validations');
const sendEmail = require('../utils/email');
const crypto = require('crypto');

// @desc    Get nearby NGOs
// @route   GET /api/ngos/nearby
// @access  Private (Donor)
exports.getNearbyNgos = async (req, res, next) => {
  try {
    const { longitude, latitude, maxDistance = 10000 } = req.query; // maxDistance in meters (default 10km)

    if (!longitude || !latitude) {
      return sendResponse(res, 400, false, null, 'Please provide longitude and latitude');
    }

    const ngos = await User.find({
      role: 'ngo',
      approvalStatus: 'approved',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseInt(maxDistance),
        },
      },
    });

    sendResponse(res, 200, true, ngos);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a donation
// @route   POST /api/donations
// @access  Private (Donor)
exports.createDonation = async (req, res, next) => {
  try {
    // Validate incoming request body
    const { error } = donationValidation(req.body);
    if (error) {
      return sendResponse(res, 400, false, null, error.details[0].message);
    }

    // req.files will contain the uploaded images if using multer
    const images = req.files ? req.files.map(file => file.path || file.filename) : [];

    const { assignedNgoId, category, description, quantity } = req.body;
    const blockchainHash = '0x' + crypto.randomBytes(20).toString('hex');

    const donation = await Donation.create({
      donorId: req.user.id,
      assignedNgoId,
      category,
      description,
      quantity,
      images,
      blockchainTxHash: blockchainHash,
    });

    // Create a tracking record for this donation
    await Tracking.create({
      donationId: donation._id,
      timeline: [
        {
          status: 'Created',
          note: 'Donation request created',
        },
      ],
    });

    // Send Confirmation Email
    if (process.env.SMTP_HOST) {
      const user = await User.findById(req.user.id);
      if (user) {
        await sendEmail({
          email: user.email,
          subject: 'Donation Scheduled Successfully - CharityAI',
          html: `
            <h1>Thank you for your generosity!</h1>
            <p>Your donation of <strong>${quantity} ${category}</strong> has been successfully scheduled.</p>
            <p><strong>Tracking ID:</strong> ${blockchainHash}</p>
            <p>You can track the status of your pickup in the CharityAI app.</p>
          `
        });
      }
    }

    sendResponse(res, 201, true, donation, 'Donation created successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get donor's donation history
// @route   GET /api/donations/my-history
// @access  Private (Donor)
exports.getMyDonations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const donations = await Donation.find({ donorId: req.user.id })
      .populate('assignedNgoId', 'name email phone')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Donation.countDocuments({ donorId: req.user.id });

    sendResponse(res, 200, true, {
      donations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get tracking details for a donation
// @route   GET /api/donations/:id/tracking
// @access  Private
exports.getDonationTracking = async (req, res, next) => {
  try {
    const tracking = await Tracking.findOne({ donationId: req.params.id }).populate('donationId');
    if (!tracking) {
      return sendResponse(res, 404, false, null, 'Tracking info not found');
    }
    
    // Authorization check
    if (
      req.user.role === 'donor' && tracking.donationId.donorId.toString() !== req.user.id
    ) {
      return sendResponse(res, 403, false, null, 'Not authorized');
    }

    sendResponse(res, 200, true, tracking);
  } catch (error) {
    next(error);
  }
};

// @desc    Get AI Smart Match
// @route   GET /api/donations/ai-match
// @access  Private (Donor)
exports.getAiMatch = async (req, res, next) => {
  try {
    const { items, latitude, longitude } = req.query;
    if (!items) {
      return sendResponse(res, 400, false, null, "Items query parameter is required for AI matching");
    }

    // 1. Get NGOs (optionally nearby if coords provided, else all approved)
    let ngos;
    if (latitude && longitude) {
      ngos = await User.find({
        role: 'ngo',
        approvalStatus: 'approved',
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
            $maxDistance: 50000 // 50km
          }
        }
      });
    } else {
      ngos = await User.find({ role: 'ngo', approvalStatus: 'approved' });
    }

    if (ngos.length === 0) {
      return sendResponse(res, 404, false, null, "No NGOs found nearby to match with");
    }

    // 2. Get requirements for these NGOs
    const ngoIds = ngos.map(ngo => ngo._id);
    const Requirement = require('../models/Requirement');
    const requirements = await Requirement.find({ ngoId: { $in: ngoIds }, isFulfilled: false });

    // 3. Prepare prompt for Gemini
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const ngoDataForPrompt = ngos.map(ngo => {
      const ngoReqs = requirements.filter(r => r.ngoId.toString() === ngo._id.toString());
      return `NGO: ${ngo.name} (ID: ${ngo._id})\nRequirements: ${ngoReqs.map(r => r.category + ' (' + r.description + ')').join(', ') || 'General Needs'}`;
    }).join('\n\n');

    const prompt = `
      You are an intelligent matching system for a charity app. 
      A donor wants to donate these items: "${items}".
      
      Here are the nearby NGOs and their current requirements:
      ${ngoDataForPrompt}
      
      Analyze the donor's items and match them with the single best NGO based on their requirements. 
      If no exact match is found, pick the most relevant NGO that accepts general donations.
      
      Return ONLY a JSON object (no markdown, no backticks) with this structure:
      {
        "matchedNgoId": "the_id_of_the_ngo",
        "reason": "A 1-2 sentence explanation of why this is the perfect match.",
        "matchScore": 95 // A number from 0 to 100 indicating match quality
      }
    `;

    // 4. Call Gemini API
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    let aiResult;
    try {
      let text = response.text.trim();
      // Clean up markdown code blocks if the model included them despite instructions
      if (text.startsWith('\`\`\`json')) text = text.replace('\`\`\`json', '').replace('\`\`\`', '').trim();
      if (text.startsWith('\`\`\`')) text = text.replace(/\`\`\`/g, '').trim();
      aiResult = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini response:", response.text);
      // Fallback
      aiResult = {
        matchedNgoId: ngos[0]._id,
        reason: "Matched based on proximity as AI matching is currently degraded.",
        matchScore: 50
      };
    }

    const matchedNgo = ngos.find(n => n._id.toString() === aiResult.matchedNgoId);

    sendResponse(res, 200, true, {
      matchedNgo: {
        id: matchedNgo._id,
        name: matchedNgo.name,
        address: matchedNgo.address,
        phone: matchedNgo.phone,
      },
      reason: aiResult.reason,
      matchScore: aiResult.matchScore
    });

  } catch (error) {
    next(error);
  }
};
