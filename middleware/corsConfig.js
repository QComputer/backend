import cors from "cors";
import winston from "winston";

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
 * Configure CORS for the application
 * @param {Object} app - Express application
 */
export const configureCORS = (app) => {
  // Parse allowed origins from environment variables
  const baseOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [];

  const additionalOrigins = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];

  const devOrigins = process.env.NODE_ENV === 'development'
    ? ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004']
    : [];

  const allowedOrigins = [...baseOrigins, ...additionalOrigins, ...devOrigins].filter(Boolean);

  // Log configured origins
  logger.info(`CORS configured with origins: ${allowedOrigins.join(', ')}`);

  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        logger.info('CORS: Allowing request with no origin');
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        logger.info(`CORS: Allowing request from ${origin}`);
        callback(null, true);
      } else {
        logger.warn(`CORS: Blocking request from ${origin}`);
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'token',
      'x-api-version',
      'x-session-id',
      'X-Requested-With'
    ],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200 // For legacy browser support
  };

  // Add CORS logging middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin || 'no-origin';
    const isPreflight = req.method === 'OPTIONS';
    
    if (isPreflight) {
      logger.info(`CORS Preflight: ${req.method} ${req.path} from ${origin}`);
    } else {
      logger.info(`CORS Request: ${req.method} ${req.path} from ${origin}`);
    }
    
    next();
  });

  // Apply CORS middleware
  app.use(cors(corsOptions));

  // Handle preflight requests explicitly
  app.options('*', cors(corsOptions));
};

export default configureCORS;