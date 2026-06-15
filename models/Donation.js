const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedNgoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    category: {
      type: String,
      required: true,
      enum: ['food', 'clothes', 'money', 'electronics', 'books', 'medicines', 'blood', 'other'],
    },
    description: {
      type: String,
      required: true,
    },
    quantity: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'in_transit', 'delivered', 'cancelled'],
      default: 'pending',
    },
    blockchainTxHash: {
      type: String,
      default: null, // Placeholder for future blockchain integration
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Donation', donationSchema);
