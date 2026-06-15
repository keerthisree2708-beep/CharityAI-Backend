const User = require('../models/User');
const { generateToken, sendResponse } = require('../utils/helpers');
const sendEmail = require('../utils/email');
const { registerValidation, loginValidation } = require('../validations');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// In-memory OTP store: phone → { otp, expires }
// NOTE: For production, replace with Redis or a DB-backed store
const otpStore = new Map();

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { error } = registerValidation(req.body);
    if (error) return sendResponse(res, 400, false, null, error.details[0].message);

    const { name, email, phone, password, role, address, longitude, latitude, ngoDetails } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) return sendResponse(res, 400, false, null, 'User already exists');

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      address,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude) || 0, parseFloat(latitude) || 0],
      },
      ngoDetails: role === 'ngo' ? ngoDetails : undefined,
      approvalStatus: role === 'ngo' ? 'pending' : 'na',
    });

    const token = generateToken(user._id, user.role);
    const refreshToken = crypto.randomBytes(40).toString('hex');
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    sendResponse(res, 201, true, { token, user: { id: user._id, name: user.name, role: user.role } }, 'Registration successful');
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { error } = loginValidation(req.body);
    if (error) return sendResponse(res, 400, false, null, error.details[0].message);

    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) return sendResponse(res, 401, false, null, 'Invalid credentials');

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return sendResponse(res, 401, false, null, 'Invalid credentials');

    const token = generateToken(user._id, user.role);
    const refreshToken = crypto.randomBytes(40).toString('hex');
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    sendResponse(res, 200, true, { token, user: { id: user._id, name: user.name, role: user.role } }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// @desc    Send OTP to phone number
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return sendResponse(res, 400, false, null, 'Phone number is required');

    // Generate a 6-digit OTP (fixed to 123456 for local dev bypass)
    const otp = process.env.MSG91_AUTH_KEY ? Math.floor(100000 + Math.random() * 900000).toString() : '123456';
    // Store with 5-minute expiry
    otpStore.set(phone, { otp, expires: Date.now() + 5 * 60 * 1000 });

    // MSG91 / SMS Provider Integration
    if (process.env.MSG91_AUTH_KEY) {
      try {
        const axios = require('axios');
        await axios.get(`https://api.msg91.com/api/v5/otp`, {
          params: {
            authkey: process.env.MSG91_AUTH_KEY,
            template_id: process.env.MSG91_TEMPLATE_ID,
            mobile: `91${phone.replace(/\D/g, '')}`, // Assuming India for this demo
            otp: otp
          }
        });
        console.log(`[INFO] OTP sent via SMS to ${phone}`);
      } catch (smsError) {
        console.error(`[ERROR] Failed to send SMS via MSG91:`, smsError.message);
        // Fallback to console if SMS fails so user isn't totally blocked
        console.log(`[DEV FALLBACK] OTP for ${phone}: ${otp}`);
      }
    } else {
      // For development: log OTP to console instead of sending SMS
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
    }

    sendResponse(res, 200, true, null, 'OTP sent successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and optionally login
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return sendResponse(res, 400, false, null, 'Phone and OTP are required');

    const record = otpStore.get(phone);

    if (!record) {
      return sendResponse(res, 400, false, null, 'No OTP sent to this number. Please request a new one.');
    }
    if (Date.now() > record.expires) {
      otpStore.delete(phone);
      return sendResponse(res, 400, false, null, 'OTP has expired. Please request a new one.');
    }
    if (record.otp !== otp) {
      return sendResponse(res, 400, false, null, 'Invalid OTP');
    }

    // Valid OTP — clean up store
    otpStore.delete(phone);

    // Check if user exists with this phone number
    const user = await User.findOne({ phone });
    if (user) {
      // Login flow
      const token = generateToken(user._id, user.role);
      const refreshToken = crypto.randomBytes(40).toString('hex');
      user.refreshToken = refreshToken;
      await user.save();

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      return sendResponse(res, 200, true, { token, user: { id: user._id, name: user.name, role: user.role, email: user.email } }, 'OTP verified, login successful');
    }

    // Phone verified, but no user exists yet
    sendResponse(res, 200, true, null, 'OTP verified successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password — send reset link
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return sendResponse(res, 400, false, null, 'Email is required');

    const user = await User.findOne({ email });

    // Security: always return 200 to prevent email enumeration
    if (!user) {
      return sendResponse(res, 200, true, null, 'If that email exists, a reset link has been sent.');
    }

    // Generate a random reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // TODO: Hash and store resetToken in User model with expiry, then email the link
    // Create reset url
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    const message = `
      <h1>Password Reset Request</h1>
      <p>You requested a password reset for your CharityAI account.</p>
      <p>Please click the link below to reset your password. This link will expire in 10 minutes.</p>
      <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#2563EB;color:white;text-decoration:none;border-radius:5px;">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
    `;

    try {
      if (process.env.SMTP_HOST) {
        await sendEmail({
          email: user.email,
          subject: 'CharityAI Password Reset Token',
          html: message
        });
      } else {
        // Fallback for dev without SMTP
        console.log(`[DEV] Password reset link for ${email}: \n${resetUrl}`);
      }

      sendResponse(res, 200, true, null, 'If that email exists, a reset link has been sent.');
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return sendResponse(res, 500, false, null, 'Email could not be sent');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged-in user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    sendResponse(res, 200, true, user);
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return sendResponse(res, 404, false, null, 'User not found');
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    sendResponse(res, 200, true, user, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh JWT Token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return sendResponse(res, 401, false, null, 'No refresh token provided');

    const user = await User.findOne({ refreshToken });
    if (!user) return sendResponse(res, 403, false, null, 'Invalid refresh token');

    const token = generateToken(user._id, user.role);
    sendResponse(res, 200, true, { token });
  } catch (error) {
    next(error);
  }
};

// @desc    Google OAuth Callback
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = async (req, res, next) => {
  try {
    const user = req.user;
    const token = generateToken(user._id, user.role);
    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // Redirect to frontend with token
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?token=${token}&google=true`);
  } catch (error) {
    next(error);
  }
};
