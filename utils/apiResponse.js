/**
 * Standardized API Response Handler
 * Provides consistent response format across all controllers
 */

/**
 * Standardize success response format
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };

  // Remove data field if null/undefined for cleaner responses
  if (data === null || data === undefined) {
    delete response.data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Standardize error response format
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {any} error - Error details
 * @param {number} statusCode - HTTP status code (default: 500)
 */
export const errorResponse = (res, message = 'An error occurred', error = null, statusCode = 500) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  // Include error details in development, hide in production
  if (process.env.NODE_ENV === 'development' && error) {
    response.error = error;
  }

  return res.status(statusCode).json(response);
};

/**
 * Standardize validation error response
 * @param {Object} res - Express response object
 * @param {string} message - Validation error message
 * @param {Array} errors - Array of validation errors
 */
export const validationErrorResponse = (res, message = 'Validation failed', errors = []) => {
  return res.status(400).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString()
  });
};

/**
 * Standardize not found response
 * @param {Object} res - Express response object
 * @param {string} message - Not found message
 */
export const notFoundResponse = (res, message = 'Resource not found') => {
  return res.status(404).json({
    success: false,
    message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Standardize unauthorized response
 * @param {Object} res - Express response object
 * @param {string} message - Unauthorized message
 */
export const unauthorizedResponse = (res, message = 'Unauthorized') => {
  return res.status(401).json({
    success: false,
    message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Standardize forbidden response
 * @param {Object} res - Express response object
 * @param {string} message - Forbidden message
 */
export const forbiddenResponse = (res, message = 'Forbidden') => {
  return res.status(403).json({
    success: false,
    message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Standardize pagination response
 * @param {Object} res - Express response object
 * @param {Array} data - Paginated data
 * @param {Object} pagination - Pagination metadata
 * @param {string} message - Success message
 */
export const paginatedResponse = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
    timestamp: new Date().toISOString()
  });
};

/**
 * Standardize file upload response
 * @param {Object} res - Express response object
 * @param {Object} fileData - File upload result
 * @param {string} message - Success message
 */
export const fileUploadResponse = (res, fileData, message = 'File uploaded successfully') => {
  return res.status(201).json({
    success: true,
    message,
    data: {
      file: fileData
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Standardize bulk operation response
 * @param {Object} res - Express response object
 * @param {Object} result - Bulk operation result
 * @param {string} message - Success message
 */
export const bulkOperationResponse = (res, result, message = 'Bulk operation completed') => {
  return res.status(200).json({
    success: true,
    message,
    data: result,
    timestamp: new Date().toISOString()
  });
};

/**
 * Create standardized response object (for use with response interceptors)
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @param {boolean} success - Success status
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Standardized response object
 */
export const createStandardResponse = (data = null, message = 'Success', success = true, statusCode = 200) => {
  const response = {
    success,
    message,
    statusCode,
    timestamp: new Date().toISOString()
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return response;
};

/**
 * Standardize API response with automatic status code determination
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Response message
 * @param {boolean} success - Success status
 * @param {number} statusCode - HTTP status code (optional, auto-determined if not provided)
 */
export const standardResponse = (res, data = null, message = 'Success', success = true, statusCode = null) => {
  // Auto-determine status code if not provided
  if (!statusCode) {
    if (success) {
      statusCode = data ? 200 : 204; // 200 if data, 204 if no content
    } else {
      statusCode = 500; // Default error status
    }
  }

  if (success) {
    return successResponse(res, data, message, statusCode);
  } else {
    return errorResponse(res, message, data, statusCode);
  }
};