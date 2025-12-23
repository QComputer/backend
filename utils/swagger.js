import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const version = '1.0.0'; // Hardcoded version for now

/**
 * Swagger/OpenAPI Documentation Generator
 * Comprehensive API documentation system
 */

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Zero Community API',
      version: version,
      description: 'Comprehensive API documentation for Zero Community Backend',
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      },
      contact: {
        name: 'Zero Community Team',
        email: 'support@zerocommunity.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server'
      },
      {
        url: 'https://api.zerocommunity.com/api',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        // Common response schemas
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Success'
            },
            data: {
              type: 'object',
              nullable: true
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            error: {
              type: 'object',
              nullable: true
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              example: 100
            },
            page: {
              type: 'integer',
              example: 1
            },
            pages: {
              type: 'integer',
              example: 10
            },
            limit: {
              type: 'integer',
              example: 10
            },
            hasMore: {
              type: 'boolean',
              example: true
            }
          }
        },
        // User schemas
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '60d5ec9f8b3a8b001f8b4567'
            },
            username: {
              type: 'string',
              example: 'johndoe'
            },
            role: {
              type: 'string',
              enum: ['admin', 'store', 'customer', 'driver', 'guest', 'staff'],
              example: 'customer'
            },
            email: {
              type: 'string',
              example: 'john@example.com'
            },
            name: {
              type: 'string',
              example: 'John Doe'
            },
            statusMain: {
              type: 'string',
              enum: ['online', 'offline', 'busy', 'soon'],
              example: 'online'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-06-25T10:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-06-25T10:30:00Z'
            }
          }
        },
        // Product schemas
        Product: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '60d5ec9f8b3a8b001f8b4567'
            },
            name: {
              type: 'string',
              example: 'Premium T-Shirt'
            },
            description: {
              type: 'string',
              example: 'High quality cotton t-shirt'
            },
            price: {
              type: 'number',
              example: 29.99
            },
            currency: {
              type: 'string',
              enum: ['IRT', 'USD'],
              example: 'USD'
            },
            category: {
              type: 'object',
              properties: {
                _id: {
                  type: 'string',
                  example: '60d5ec9f8b3a8b001f8b4568'
                },
                name: {
                  type: 'string',
                  example: 'Clothing'
                }
              }
            },
            store: {
              type: 'object',
              properties: {
                _id: {
                  type: 'string',
                  example: '60d5ec9f8b3a8b001f8b4569'
                },
                username: {
                  type: 'string',
                  example: 'fashionstore'
                },
                name: {
                  type: 'string',
                  example: 'Fashion Store'
                }
              }
            },
            image: {
              type: 'string',
              example: 'https://example.com/image.jpg'
            },
            available: {
              type: 'boolean',
              example: true
            },
            stock: {
              type: 'integer',
              example: 100
            },
            ratings: {
              type: 'number',
              example: 4.5
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['clothing', 't-shirt', 'premium']
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-06-25T10:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-06-25T10:30:00Z'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Users',
        description: 'User management and profiles'
      },
      {
        name: 'Products',
        description: 'Product management and catalog'
      },
      {
        name: 'Orders',
        description: 'Order processing and management'
      },
      {
        name: 'Cart',
        description: 'Shopping cart functionality'
      },
      {
        name: 'Messages',
        description: 'Messaging system'
      },
      {
        name: 'Social',
        description: 'Social features (follow, friends)'
      },
      {
        name: 'Catalogs',
        description: 'Catalog management'
      },
      {
        name: 'Categories',
        description: 'Product categories'
      },
      {
        name: 'Images',
        description: 'Image management'
      },
      {
        name: 'Admin',
        description: 'Administrative functions'
      }
    ]
  },
  apis: [
    './routes/*.js',
    './controllers/*.js'
  ]
};

/**
 * Generate Swagger documentation
 * @returns {Object} Swagger specification
 */
export const generateSwaggerDocs = () => {
  return swaggerJsdoc(swaggerOptions);
};

/**
 * Setup Swagger UI
 * @param {Object} app - Express application
 */
export const setupSwaggerUI = (app) => {
  const swaggerSpec = generateSwaggerDocs();
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // JSON endpoint for programmatic access
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

/**
 * Swagger documentation decorator for routes
 * @param {Object} options - Documentation options
 * @returns {Function} Middleware function
 */
export const swaggerDoc = (options = {}) => {
  return (req, res, next) => {
    // This middleware can be used to add Swagger documentation to specific routes
    // The actual Swagger docs are generated from JSDoc comments
    next();
  };
};

export default {
  generateSwaggerDocs,
  setupSwaggerUI,
  swaggerDoc
};