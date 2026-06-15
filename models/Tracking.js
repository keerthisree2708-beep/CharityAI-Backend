const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema(
  {
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      required: true,
      unique: true,
    },
    driverDetails: {
      name: String,
      phone: String,
      vehicleNumber: String,
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere',
        default: [0, 0],
      },
    },
    eta: {
      type: Date,
    },
    timeline: [
      {
        status: String, // e.g., 'Picked up', 'In transit', 'Arrived'
        timestamp: {
          type: Date,
          default: Date.now,
        },
        location: {
          type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
          },
          coordinates: {
            type: [Number],
          },
        },
        note: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Tracking', trackingSchema);
