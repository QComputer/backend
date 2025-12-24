import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import winston from "winston";
import { errorHandler, notFoundHandler, asyncHandler } from "./errorHandler.js";
import { validateEnvironmentVariables } from "../utils/validation.js";

/**
 * Unified Middleware System
 * Consolidates all middleware configuration in one place
 */

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

/**
 * Setup all middleware for Express app
 * @param {Object} app - Express application
 */
export const setupMiddleware = (app) => {
  // Validate environment first
  try {
    const envValidation = validateEnvironmentVariables();
    if (envValidation.warnings.length > 0) {
      envValidation.warnings.forEach(warning => logger.warn(warning));
    }
    logger.info('✅ Environment variables validated successfully');
  } catch (error) {
    logger.error('❌ Environment validation failed:', error.message);
    process.exit(1);
  }

  // Security middleware
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
  }));

  // Compression middleware
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  // CORS configuration
  const baseOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [];

  const additionalOrigins = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];

  const devOrigins = process.env.NODE_ENV === 'development'
    ? ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003']
    : [];

  const allowedOrigins = [...baseOrigins, ...additionalOrigins, ...devOrigins].filter(Boolean);

  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,token,x-api-version,x-session-id',
    maxAge: 86400
  };

  // CORS logging middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin || 'unknown';
    const isAllowed = !origin || allowedOrigins.includes(origin);
    logger.info(`CORS Request: ${req.method} ${req.path} from ${origin} - ${isAllowed ? 'Allowed' : 'Blocked'}`);
    next();
  });

  app.use(cors(corsOptions));

  // Request body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use((req, res, next) => {
    req.startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    next();
  });

  // Health check endpoint
  app.get('/health', async (req, res) => {
    const healthData = await generateHealthData();
    res.json(healthData);
  });

  // Root endpoint
  app.get('/', (req, res) => {
    const serverInfo = {
      message: "Zero Community Backend API",
      status: "running",
      version: "1.0.0",
      port: process.env.PORT || 3000,
      timestamp: new Date().toISOString(),
      endpoints: {
        health: "/health",
        api: "/api/*",
        documentation: "/api-docs"
      }
    };
    res.json(serverInfo);
  });

};

/**
 * Generate health check data
 * @returns {Object} Health check data
 */
const generateHealthData = async () => {
  // This would include database checks, memory usage, etc.
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: {
      name: "Zero Community Backend API",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development"
    },
    uptime: process.uptime(),
    performance: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  };
};

/**
 * API versioning middleware
 * @param {string} version - API version
 * @returns {Function} Middleware function
 */
export const apiVersion = (version) => {
  return (req, res, next) => {
    req.apiVersion = version;
    res.setHeader('X-API-Version', version);
    next();
  };
};

/**
 * Role-based access control middleware
 * @param {Array} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
export const roleBasedAccess = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions'
      });
    }
    next();
  };
};

/**
 * Request validation middleware
 * @param {Function} validationSchema - Validation function
 * @returns {Function} Middleware function
 */
export const validateRequest = (validationSchema) => {
  return (req, res, next) => {
    try {
      const validationResult = validationSchema(req.body);
      if (!validationResult.valid) {
        return res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default {
  setupMiddleware,
  apiVersion,
  roleBasedAccess,
  validateRequest,
  asyncHandler
};