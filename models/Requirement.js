const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema(
  {
    ngoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: true,
      // Must match Donation.js category enum
      enum: ['food', 'clothes', 'money', 'electronics', 'books', 'medicines', 'blood', 'other'],
    },
    description: {
      type: String,
      required: true,
    },
    quantity: {
      type: String,
      default: 'Not specified',
    },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    needByDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'fulfilled', 'closed'],
      default: 'open',
    },
    isFulfilled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Requirement', requirementSchema);

