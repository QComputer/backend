/**
 * Standardized API Utilities
 * Provides consistent error handling, response formatting, and field normalization
 */

import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/api-utils.log' })
  ]
});

/**
 * Standardized error response format
 * @param {string} message - Error message
 * @param {string|null} details - Additional error details
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Standardized error response
 */
export const standardError = (message, details = null, statusCode = 400) => {
  const errorResponse = {
    success: false,
    message: message,
    timestamp: new Date().toISOString()
  };

  // Add details if provided
  if (details) {
    errorResponse.error = details;
  }

  // Add status code for reference
  errorResponse.statusCode = statusCode;

  logger.error(`API Error [${statusCode}]: ${message}`, {
    details: details,
    timestamp: errorResponse.timestamp
  });

  return errorResponse;
};

/**
 * Standardized success response format
 * @param {string} message - Success message
 * @param {Object|null} data - Response data
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Standardized success response
 */
export const standardSuccess = (message, data = null, statusCode = 200) => {
  const successResponse = {
    success: true,
    message: message,
    timestamp: new Date().toISOString()
  };

  // Add data if provided
  if (data !== null && data !== undefined) {
    successResponse.data = data;
  }

  // Add status code for reference
  successResponse.statusCode = statusCode;

  logger.info(`API Success [${statusCode}]: ${message}`);

  return successResponse;
};

/**
 * Normalize product IDs - handle both object and string formats
 * @param {Array} products - Array of product references (can be objects or strings)
 * @returns {Array} Array of normalized product IDs
 */
export const normalizeProductIds = (products) => {
  if (!products || !Array.isArray(products)) {
    return [];
  }

  return products.map(product => {
    if (typeof product === 'object' && product !== null) {
      // Handle object format - extract _id or id
      return product._id || product.id || String(product);
    }
    // Handle string/ID format
    return String(product);
  });
};

/**
 * Normalize user references
 * @param {Object|string} userRef - User reference (can be object or string)
 * @returns {string} Normalized user ID
 */
export const normalizeUserId = (userRef) => {
  if (!userRef) return null;

  if (typeof userRef === 'object') {
    return userRef._id || userRef.id || null;
  }

  return String(userRef);
};

/**
 * Standardize field names - ensure consistent naming conventions
 * @param {Object} data - Input data object
 * @param {Object} fieldMapping - Mapping of field name conversions
 * @returns {Object} Data with standardized field names
 */
export const standardizeFieldNames = (data, fieldMapping = {}) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const standardizedData = { ...data };

  // Apply field name conversions
  for (const [oldField, newField] of Object.entries(fieldMapping)) {
    if (standardizedData[oldField] !== undefined) {
      standardizedData[newField] = standardizedData[oldField];
      delete standardizedData[oldField];
    }
  }

  return standardizedData;
};

/**
 * Standard field name mappings
 */
export const STANDARD_FIELD_MAPPING = {
  // User/owner field standardization
  userId: 'ownerId',
  user_id: 'ownerId',
  creatorId: 'ownerId',

  // Product field standardization
  productIds: 'products',
  product_ids: 'products',
  items: 'products',

  // Common variations
  desc: 'description',
  title: 'name',
  isPublic: 'visibility'
};

/**
 * Validate and sanitize catalog input data
 * @param {Object} catalogData - Raw catalog data
 * @returns {Object} Sanitized catalog data
 */
export const sanitizeCatalogData = (catalogData) => {
  // Standardize field names
  const standardized = standardizeFieldNames(catalogData, STANDARD_FIELD_MAPPING);

  // Normalize product IDs
  if (standardized.products) {
    standardized.products = normalizeProductIds(standardized.products);
  }

  // Normalize featured products
  if (standardized.featuredProducts) {
    standardized.featuredProducts = normalizeProductIds(standardized.featuredProducts);
  }

  // Normalize owner ID
  if (standardized.ownerId) {
    standardized.ownerId = normalizeUserId(standardized.ownerId);
  }

  // Trim string fields
  const stringFields = ['name', 'slug', 'description', 'shortDescription'];
  stringFields.forEach(field => {
    if (standardized[field] && typeof standardized[field] === 'string') {
      standardized[field] = standardized[field].trim();
    }
  });

  return standardized;
};

/**
 * Authentication middleware wrapper
 * Standardizes token handling from multiple header locations
 */
export const unifiedAuthMiddleware = (req, res, next) => {
  try {
    // Check for token in multiple possible locations
    let token = req.headers.token ||
               req.headers.authorization ||
               req.headers['x-access-token'] ||
               req.query.token;

    // Clean up token format
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    if (token) {
      req.token = token;
      req.authenticated = true;
    }

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    next();
  }
};

/**
 * API documentation generator
 * Generates basic OpenAPI documentation for endpoints
 */
export const generateApiDocs = () => {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Zero Project Catalog API',
      version: '1.0.0',
      description: 'Standardized Catalog API Documentation'
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server'
      }
    ],
    paths: {
      '/catalog': {
        post: {
          summary: 'Create a new catalog',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Catalog'
                }
              }
            }
          },
          responses: {
            201: {
              description: 'Catalog created successfully'
            },
            400: {
              description: 'Invalid input data'
            }
          }
        }
      }
      // Additional endpoints would be added here
    },
    components: {
      schemas: {
        Catalog: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            ownerId: { type: 'string' },
            products: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ['draft', 'published', 'archived'] }
          },
          required: ['name', 'slug', 'ownerId']
        }
      }
    }
  };
};

// Export all utilities
export default {
  standardError,
  standardSuccess,
  normalizeProductIds,
  normalizeUserId,
  standardizeFieldNames,
  STANDARD_FIELD_MAPPING,
  sanitizeCatalogData,
  unifiedAuthMiddleware,
  generateApiDocs
};