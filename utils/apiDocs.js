/**
 * Basic API Documentation for Catalog Endpoints
 * Generated using OpenAPI/Swagger standards
 */

import { generateApiDocs } from './apiUtils.js';

/**
 * Generate basic API documentation for catalog endpoints
 * @returns {Object} OpenAPI documentation object
 */
export const generateCatalogApiDocs = () => {
  return generateApiDocs();
};

/**
 * Get API documentation for a specific endpoint
 * @param {string} endpoint - API endpoint path (e.g., '/catalog')
 * @returns {Object} OpenAPI documentation for the endpoint
 */
export const getCatalogEndpointDocs = (endpoint) => {
  const docs = generateApiDocs();

  // Add catalog-specific endpoints to the documentation
  docs.paths['/catalog'] = {
    post: {
      summary: 'Create a new catalog',
      description: 'Create a new catalog with the provided data',
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
          description: 'Catalog created successfully',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SuccessResponse'
              }
            }
          }
        },
        400: {
          description: 'Bad request or validation errors',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponses'
              }
            }
          }
        }
      }
      security: [
        {
          bearerAuth: []
        }
      ]
    }
    components: {
      schemas: {
        Catalog: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            ownerId: { type: 'string' },
            products: {
              type: 'array',
              items: { type: 'string' }
            },
            featuredProducts: {
              type: 'array',
              items: { type: 'string' }
            },
            theme: {
              type: 'string',
              enum: ['light', 'dark', 'auto', 'custom']
            }
          },
          required: ['name', 'slug', 'ownerId']
        },
        SuccessResponses: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object'
            },
            timestamp: { type: 'string' }
          }
        },
        ErrorResponses: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            error: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object'
            },
            statusCode: { type: 'numbers' }
          }
        }
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT [token]'
        }
        jwt: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Bearer [token]'
        }
      }
      tags: [
        { name: 'catalog', description: 'Catalog management endpoints' },
        { name: 'auth', description: 'Authentication and authorization endpoints' },
        { name: 'products', description: 'Product management endpoints' },
        { name: 'templates', description: 'Template management endpoints' }
      ]
    }
    info: {
      version: '1.0.0',
      title: 'Zero Project Catalog API',
      description: 'Comprehensive catalog management API with standardized responses and authentication',
      contact: {
        name: 'API Support',
        email: 'support@zeroproject.com'
      },
      license: {
        name: 'MIT License',
        url: 'https://opensource.org/licenses/MIT'
      }
    }
  };