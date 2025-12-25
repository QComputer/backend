import mongoose from "mongoose";
import winston from "winston";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Global flag to track connection status
let isConnected = false;
let connectionAttempts = 0;
const maxRetries = 5;

export const connectDB = async () => {
  // Use the exact same connection string and configuration as the working original backend
  const mongoUri = process.env.MONGO_URI;//'mongodb+srv://dissonancee:zqXplWy1Zldu9NIc@cluster1.6chp5nv.mongodb.net/zero';

  const connectWithRetry = async (retries = maxRetries) => {
    try {
      logger.info(`Attempting to connect to MongoDB (attempt ${connectionAttempts + 1}/${maxRetries + 1})`);

      // Use exact same configuration as working original backend
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000, // Same as original
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority',
        readPreference: 'primary'
      });

      isConnected = true;
      connectionAttempts = 0;
      logger.info("✅ MongoDB Connected successfully");

      mongoose.connection.on('connected', () => {
        logger.info('📊 MongoDB: Connected to database');
      });

      mongoose.connection.on('error', (err) => {
        logger.error('❌ MongoDB Error:', err);
        isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('⚠️ MongoDB: Disconnected from database');
        isConnected = false;
      });

      // Periodic health check
      setInterval(() => {
        const state = mongoose.connection.readyState;
        const states = {
          0: 'disconnected',
          1: 'connected',
          2: 'connecting',
          3: 'disconnecting'
        };
        logger.info(`📊 Database Status: ${states[state]} (${state})`);

        if (state === 0 && isConnected) {
          logger.warn('⚠️ Database disconnected, attempting to reconnect...');
          isConnected = false;
          connectWithRetry(3); // Retry up to 3 times for reconnection
        }
      }, 30000);

    } catch (error) {
      connectionAttempts++;
      logger.error(`❌ MongoDB Connection Failed (attempt ${connectionAttempts}/${maxRetries + 1}):`, error.message);

      if (retries > 0) {
        const delay = Math.min(1000 * Math.pow(2, maxRetries - retries), 30000); // Exponential backoff
        logger.info(`⏳ Retrying connection in ${delay}ms...`);
        setTimeout(() => connectWithRetry(retries - 1), delay);
      } else {
        logger.error('❌ Max retries reached. Server will continue without database connection.');
        logger.warn('⚠️ Some features may not work properly without database connectivity.');
        // Don't exit the process - allow server to continue
        isConnected = false;
      }
    }
  };

  // Start initial connection attempt
  await connectWithRetry();
};

// Function to check database connectivity
export const isDatabaseConnected = () => {
  return isConnected && mongoose.connection.readyState === 1;
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('📊 Received SIGINT. Closing database connection...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('📊 Received SIGTERM. Closing database connection...');
  await mongoose.connection.close();
  process.exit(0);
});