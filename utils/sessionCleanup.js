import sessionModel from '../models/sessionModel.js';
import cartModel from '../models/cartModel.js';
import winston from 'winston';

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

/**
 * Session Cleanup Job
 * Removes expired sessions and associated guest carts
 */
class SessionCleanup {
  constructor() {
    this.running = false;
    this.cleanupInterval = null;
  }

  /**
   * Start the cleanup job
   * Runs cleanup immediately and then on interval
   */
  start() {
    if (this.running) {
      logger.info('Session cleanup job is already running');
      return;
    }

    this.running = true;
    const cleanupIntervalHours = parseInt(process.env.SESSION_CLEANUP_INTERVAL_HOURS) || 1;
    const aggressiveCleanup = process.env.AGGRESSIVE_SESSION_CLEANUP === 'true';

    // Run immediately
    this.runCleanup().catch(error => {
      logger.error('Initial session cleanup failed:', error);
    });

    // Set up interval
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(error => {
        logger.error('Scheduled session cleanup failed:', error);
      });
    }, cleanupIntervalHours * 60 * 60 * 1000);

    logger.info(`⏰ Session cleanup job started. Will run every ${cleanupIntervalHours} hours.`);
  }

  /**
   * Stop the cleanup job
   */
  stop() {
    if (!this.running) {
      logger.info('Session cleanup job is not running');
      return;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.running = false;
    logger.info('🛑 Session cleanup job stopped.');
  }

  /**
   * Run the cleanup process
   */
  async runCleanup() {
    logger.info('🧹 Starting session cleanup...');

    try {
      const now = new Date();
      const aggressiveCleanup = process.env.AGGRESSIVE_SESSION_CLEANUP === 'true';
      const cleanupThreshold = new Date(now.getTime() - (aggressiveCleanup ? 6 : 24) * 60 * 60 * 1000); // 6 hours (aggressive) or 24 hours ago

      logger.info(`🧹 Session cleanup threshold: ${aggressiveCleanup ? '6 hours (aggressive)' : '24 hours'}`);

      // Find expired sessions
      const expiredSessions = await sessionModel.find({
        $or: [
          { expiresAt: { $lt: now } },
          { updatedAt: { $lt: cleanupThreshold } }
        ]
      }).limit(2000); // Increased batch size for aggressive cleanup

      logger.info(`🗑️  Found ${expiredSessions.length} expired sessions to clean up`);

      if (expiredSessions.length === 0) {
        return;
      }

      // Clean up sessions and associated carts
      const cleanupResults = {
        sessionsRemoved: 0,
        guestCartsRemoved: 0,
        errors: 0
      };

      // Process sessions in parallel with error handling
      const cleanupPromises = expiredSessions.map(async (session) => {
        try {
          // Remove session
          await sessionModel.deleteOne({ _id: session._id });
          cleanupResults.sessionsRemoved++;

          // Remove associated guest cart if it exists
          if (session.isGuest && session.cartId) {
            await cartModel.deleteOne({ _id: session.cartId });
            cleanupResults.guestCartsRemoved++;
          } else if (session.isGuest && session.sessionId) {
            // For backward compatibility: remove carts by sessionId
            await cartModel.deleteOne({ sessionId: session.sessionId });
            cleanupResults.guestCartsRemoved++;
          }

        } catch (error) {
          logger.error(`❌ Failed to clean up session ${session.sessionId}:`, error.message);
          cleanupResults.errors++;
        }
      });

      await Promise.all(cleanupPromises);

      // Additional cleanup: Remove orphaned guest carts without sessions
      const orphanedCarts = await cartModel.countDocuments({
        sessionId: { $exists: true, $ne: null },
        $and: [
          { sessionId: { $ne: '' } },
          { updatedAt: { $lt: cleanupThreshold } }
        ]
      });

      if (orphanedCarts > 0) {
        logger.info(`🧹 Found ${orphanedCarts} orphaned guest carts, removing...`);
        const orphanedResult = await cartModel.deleteMany({
          sessionId: { $exists: true, $ne: null },
          $and: [
            { sessionId: { $ne: '' } },
            { updatedAt: { $lt: cleanupThreshold } }
          ]
        });
        cleanupResults.guestCartsRemoved += orphanedResult.deletedCount || 0;
      }

      logger.info(`🧹 Cleanup completed: ${cleanupResults.sessionsRemoved} sessions, ` +
                 `${cleanupResults.guestCartsRemoved} carts removed, ` +
                 `${cleanupResults.errors} errors`);

    } catch (error) {
      logger.error('❌ Session cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Manual cleanup trigger (for testing/debugging)
   */
  async manualCleanup() {
    if (this.running) {
      logger.warn('Manual cleanup called while automatic cleanup is running');
    }
    return this.runCleanup();
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    try {
      const now = new Date();
      const aggressiveCleanup = process.env.AGGRESSIVE_SESSION_CLEANUP === 'true';
      const cleanupThreshold = new Date(now.getTime() - (aggressiveCleanup ? 6 : 24) * 60 * 60 * 1000);

      const expiredSessionsCount = await sessionModel.countDocuments({
        expiresAt: { $lt: now }
      });

      const inactiveSessionsCount = await sessionModel.countDocuments({
        updatedAt: { $lt: cleanupThreshold },
        expiresAt: { $gte: now }
      });

      const activeSessionsCount = await sessionModel.countDocuments({
        expiresAt: { $gte: now },
        updatedAt: { $gte: cleanupThreshold }
      });

      const expiredCartsCount = await cartModel.countDocuments({
        expiresAt: { $lt: now }
      });

      const orphanedCartsCount = await cartModel.countDocuments({
        sessionId: { $exists: true, $ne: null },
        $and: [
          { sessionId: { $ne: '' } },
          { updatedAt: { $lt: cleanupThreshold } }
        ]
      });

      return {
        expiredSessions: expiredSessionsCount,
        inactiveSessions: inactiveSessionsCount,
        activeSessions: activeSessionsCount,
        expiredCarts: expiredCartsCount,
        orphanedCarts: orphanedCartsCount,
        totalSessions: expiredSessionsCount + inactiveSessionsCount + activeSessionsCount,
        cleanupMode: aggressiveCleanup ? 'aggressive (6 hours)' : 'standard (24 hours)'
      };

    } catch (error) {
      logger.error('Failed to get cleanup stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
const sessionCleanup = new SessionCleanup();
export default sessionCleanup;