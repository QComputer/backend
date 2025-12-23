// Standardized error response format
const createErrorResponse = (message, statusCode = 500, error = null) => ({
  success: false,
  message,
  error: error?.message || error,
  timestamp: new Date().toISOString(),
  statusCode
});

// Standardized success response format
const createSuccessResponse = (data, message = "Success", statusCode = 200) => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
  statusCode
});

export {
  createErrorResponse,
  createSuccessResponse
};