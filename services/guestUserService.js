/**
 * Guest User Service
 * Handles automatic creation and management of guest users for unauthenticated visitors
 */

import userModel from '../models/userModel.js';
import cartModel from '../models/cartModel.js';
import winston from 'winston';

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
 * Guest User Service Class
 * Manages guest user lifecycle and session association
 */
class GuestUserService {
  /**
   * Create a new guest user
   * @param {Object} metadata - Additional metadata about the guest session
   * @returns {Promise<Object>} Created guest user object
   */
  async createGuestUser(metadata = {}) {
    try {
      // Generate unique guest username
      const guestId = this.generateGuestId();
      const username = `guest_${guestId}`;
      
      
      // Create guest user
      const guestUser = new userModel({
        username: username,
        role: 'guest',
        name: 'Guest User',
        email: null,
        phone: null,
        moreInfo: 'Temporary guest account',
        statusMain: 'online', // Use valid enum value
        statusCustom: 'browsing',
        avatar: null,
        image: null,
        locationLat: null,
        locationLng: null,
        shareLocation: false,
        password: 'guest_temp_password', // Provide required password
        // Guest-specific fields
        isTemporary: true,
        sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        metadata: {
          ...metadata,
          createdAt: new Date(),
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
          deviceType: metadata.deviceType || 'unknown'
        }
      });
      await guestUser.save();
      
      logger.info(`Guest user created: ${username} (${guestUser._id})`);
      
      return {
        user: guestUser,
        sessionId: guestId,
        token: null // Guests don't get JWT tokens, they use session IDs
      };
    } catch (error) {
      logger.error('Failed to create guest user:', error);
      throw new Error(`Guest user creation failed: ${error.message}`);
    }
  }

  /**
   * Get or create guest user for a session
   * @param {string} sessionId - Guest session ID
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Guest user and session info
   */
  async getOrCreateGuestUser(sessionId, metadata = {}) {
    try {
      // Check if session ID corresponds to an existing guest user
      if (sessionId && sessionId.startsWith('guest_')) {
        const existingUser = await userModel.findOne({ 
          username: sessionId,
          role: 'guest',
          isTemporary: true
        });

        if (existingUser) {
          // Extend session expiry
          existingUser.sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await existingUser.save();
          
          logger.info(`Existing guest user found: ${sessionId}`);
          return {
            user: existingUser,
            sessionId: sessionId,
            isNew: false
          };
        }
      }

      // Create new guest user
      const result = await this.createGuestUser(metadata);
      
      return {
        user: result.user,
        sessionId: result.sessionId,
        isNew: true
      };
    } catch (error) {
      logger.error('Failed to get or create guest user:', error);
      throw error;
    }
  }

  /**
   * Clean up expired guest users
   * @param {number} maxAgeHours - Maximum age in hours (default: 48)
   * @returns {Promise<number>} Number of users cleaned up
   */
  async cleanupExpiredGuests(maxAgeHours = 48) {
    try {
      const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      
      // Find expired guest users
      const expiredGuests = await userModel.find({
        role: 'guest',
        isTemporary: true,
        sessionExpiry: { $lt: cutoffDate }
      });

      if (expiredGuests.length === 0) {
        return 0;
      }

      // Delete associated carts first
      const guestUserIds = expiredGuests.map(user => user._id);
      await cartModel.deleteMany({ user: { $in: guestUserIds } });

      // Delete expired guest users
      await userModel.deleteMany({ _id: { $in: guestUserIds } });

      logger.info(`Cleaned up ${expiredGuests.length} expired guest users`);
      return expiredGuests.length;
    } catch (error) {
      logger.error('Failed to cleanup expired guests:', error);
      throw error;
    }
  }

  /**
   * Generate unique guest ID
   * @returns {string} Unique guest identifier
   */
  generateGuestId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `${timestamp}_${random}`;
  }

  /**
   * Validate guest user
   * @param {string} userId - User ID to validate
   * @returns {Promise<boolean>} Whether guest user is valid
   */
  async validateGuestUser(userId) {
    try {
      const user = await userModel.findById(userId);
      
      if (!user || user.role !== 'guest' || !user.isTemporary) {
        return false;
      }

      // Check if session has expired
      if (user.sessionExpiry && new Date() > user.sessionExpiry) {
        await this.cleanupExpiredGuests(0); // Force cleanup
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Guest user validation failed:', error);
      return false;
    }
  }

  /**
   * Get guest user statistics
   * @returns {Promise<Object>} Guest user statistics
   */
  async getGuestStats() {
    try {
      const totalGuests = await userModel.countDocuments({
        role: 'guest',
        isTemporary: true
      });

      const activeGuests = await userModel.countDocuments({
        role: 'guest',
        isTemporary: true,
        sessionExpiry: { $gt: new Date() }
      });

      const expiredGuests = totalGuests - activeGuests;

      return {
        total: totalGuests,
        active: activeGuests,
        expired: expiredGuests
      };
    } catch (error) {
      logger.error('Failed to get guest stats:', error);
      throw error;
    }
  }

  /**
   * Convert guest user to regular user (during registration)
   * @param {string} guestUserId - Guest user ID
   * @param {Object} userData - New user data
   * @returns {Promise<Object>} Updated user
   */
  async convertGuestToUser(guestUserId, userData) {
    try {
      const guestUser = await userModel.findById(guestUserId);
      
      if (!guestUser || guestUser.role !== 'guest' || !guestUser.isTemporary) {
        throw new Error('Invalid guest user');
      }

      // Update guest user to regular user
      guestUser.role = userData.role || 'customer';
      guestUser.username = userData.username;
      guestUser.name = userData.name;
      guestUser.email = userData.email;
      guestUser.phone = userData.phone;
      guestUser.moreInfo = userData.moreInfo || 'Converted from guest';
      guestUser.isTemporary = false;
      guestUser.statusMain = 'active';
      guestUser.statusCustom = 'active';
      guestUser.sessionExpiry = null;
      guestUser.metadata = {
        ...guestUser.metadata,
        convertedAt: new Date(),
        originalGuestId: guestUser.username
      };

      await guestUser.save();
      
      logger.info(`Guest user converted to regular user: ${guestUser.username}`);
      return guestUser;
    } catch (error) {
      logger.error('Failed to convert guest user:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new GuestUserService();