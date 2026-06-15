const { sendResponse } = require('../utils/helpers');

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return sendResponse(res, 404, false, null, 'Resource not found');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    return sendResponse(res, 400, false, null, 'Duplicate field value entered');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    return sendResponse(res, 400, false, null, message);
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
  });
};

module.exports = errorHandler;
