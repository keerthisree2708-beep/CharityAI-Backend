const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendResponse } = require('../utils/helpers');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendResponse(res, 401, false, null, 'Not authorized to access this route');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return sendResponse(res, 401, false, null, 'User account no longer exists');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendResponse(res, 401, false, null, 'Session expired. Please log in again');
    }
    return sendResponse(res, 401, false, null, 'Not authorized to access this route');
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendResponse(
        res,
        403,
        false,
        null,
        `User role ${req.user.role} is not authorized to access this route`
      );
    }
    next();
  };
};

// Optional auth - doesn't fail if no token, but sets req.user if valid token exists
exports.optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (user) {
      req.user = user;
    }
    next();
  } catch (err) {
    // If token is invalid/expired, just proceed as unauthenticated
    next();
  }
};
