const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    phone: {
      type: String,
      required: function() {
        // Phone is optional if the user signed up via Google OAuth
        return !this.googleId;
      },
    },
    password: {
      type: String,
      required: function() {
        // Password is not required if the user signed up via Google OAuth
        return !this.googleId;
      },
      minlength: 6,
      select: false,
    },
    googleId: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    role: {
      type: String,
      enum: ['donor', 'ngo', 'admin'],
      default: 'donor',
    },
    address: {
      type: String,
      required: function() {
        // Address is optional for Google OAuth users
        return !this.googleId;
      },
      default: '',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        index: '2dsphere',
        default: [0, 0],
      },
    },
    profileImage: {
      type: String,
      default: 'no-photo.jpg',
    },
    // Specific to NGOs
    ngoDetails: {
      registrationNumber: String,
      description: String,
      website: String,
      establishedYear: Number,
      documents: [String],
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'na'],
      default: 'na', // 'pending' only for NGOs; donors and admins use 'na'
    },
  },
  {
    timestamps: true,
  }
);

// Required for $near geospatial queries (nearby NGO search)
userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);
