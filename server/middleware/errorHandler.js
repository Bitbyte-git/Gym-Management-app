const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  let error = { ...err };
  error.message = err.message;

  // Log error for dev
  console.error(JSON.stringify({ event: 'request_error', name: err.name, code: err.code, status: err.statusCode || err.status || 500 }));

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'This record conflicts with an existing record';
    error = { message, statusCode: 409 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  const statusCode = error.statusCode || err.status || 500;
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'Server error'
    : error.message || 'Server Error';
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
