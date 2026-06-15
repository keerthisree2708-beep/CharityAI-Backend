const jwt = require('jsonwebtoken');

// Generate JWT Token
exports.generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// Standardized API response
exports.sendResponse = (res, statusCode, success, data, message = null) => {
  const payload = { success };
  if (data) payload.data = data;
  if (message) payload.message = message;
  
  return res.status(statusCode).json(payload);
};
