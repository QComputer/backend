import winston from "winston";
import { createErrorResponse } from "../utils/errorUtils.js";

/**
 * Unified Error Handling Middleware
 * Centralized error handling for consistent error responses
 */

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

/**
 * Error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method}`, {
    error: err.stack,
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    },
    timestamp: new Date().toISOString()
  });

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => error.message);
    const errorResponse = createErrorResponse('Validation failed', 422, {
      details: errors
    });
    return res.status(errorResponse.statusCode).json(errorResponse.response);
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    const errorResponse = createErrorResponse(`Invalid ${err.path}: ${err.value}`, 400);
    return res.status(errorResponse.statusCode).json(errorResponse.response);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    const errorResponse = createErrorResponse('Invalid token', 401);
    return res.status(errorResponse.statusCode).json(errorResponse.response);
  }

  // Handle TokenExpiredError
  if (err.name === 'TokenExpiredError') {
    const errorResponse = createErrorResponse('Token expired', 401);
    return res.status(errorResponse.statusCode).json(errorResponse.response);
  }

  // Handle duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    const errorResponse = createErrorResponse(`${field} already exists`, 409);
    return res.status(errorResponse.statusCode).json(errorResponse.response);
  }

  // Default error handling
  const statusCode = err.status || 500;
  const errorResponse = createErrorResponse(err.message || 'Internal Server Error', statusCode, {
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  res.status(errorResponse.statusCode).json(errorResponse.response);
};

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export const notFoundHandler = (req, res, next) => {
  const errorResponse = createErrorResponse(`Not Found - ${req.originalUrl}`, 404);
  res.status(errorResponse.statusCode).json(errorResponse.response);
};

/**
 * Async wrapper for route handlers
 * @param {Function} fn - Route handler function
 * @returns {Function} Wrapped function with error handling
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler
};