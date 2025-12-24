import userModel from "../models/userModel.js";
import cartModel from "../models/cartModel.js";
import productModel from "../models/productModel.js";
import winston from "winston";
import { authMiddleware } from '../middleware/auth.js';
import { successResponse, errorResponse, notFoundResponse } from '../utils/apiResponse.js';
// Removed unused imports - using Winston logger instead
import cartService from '../services/cartService.js';

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
 * Get cart for authenticated user
 */
const getCart = async (req, res) => {
  try {
    // Unified approach: use req.user for both guest and authenticated users
    const userContext = req.user ? { userId: req.userId } : null;
    
    // Handle anonymous users by using session-based carts
    if (userContext && req.userId === 'anonymous') {
      // For anonymous users, create a session-based cart
      const sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const cart = await cartService.getCart(sessionId);
      return successResponse(res, cart, 'Guest cart retrieved successfully');
    }
    
    if (!userContext) {
      return errorResponse(res, 'Authentication required', null, 401);
    }
 
    const cart = await cartService.getCart(userContext);
    
    logger.info(`Cart retrieved for user: ${req.userId} (${req.sessionType})`);
    return successResponse(res, cart, 'Cart retrieved successfully');
  } catch (error) {
    logger.error('Error getting cart:', error);
    return errorResponse(res, error.message || 'Failed to get cart', error, 500);
  }
};

/**
 * Add item to cart for authenticated user
 */
const addToCart = async (req, res) => {
  try {
    // Unified approach: use req.user for both guest and authenticated users
    const userContext = req.user ? { userId: req.userId } : null;
    
    // Handle anonymous users by using session-based carts
    if (userContext && req.userId === 'anonymous') {
      // For anonymous users, create a session-based cart
      const sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const { productId, quantity, catalogId } = req.body;
      const cart = await cartService.addToCart(sessionId, productId, quantity || 1, catalogId);
      return successResponse(res, cart, 'Item added to guest cart successfully');
    }
    
    if (!userContext) {
      return errorResponse(res, 'Authentication required', null, 401);
    }
 
    const { productId, quantity, catalogId } = req.body;
 
    if (!productId) {
      return errorResponse(res, 'Product ID is required', null, 400);
    }
 
    const cart = await cartService.addToCart(userContext, productId, quantity || 1, catalogId);
     
    logger.info(`Item added to cart: ${productId} from catalog ${catalogId}, user ${req.userId} (${req.sessionType})`);
    return successResponse(res, cart, 'Item added to cart successfully');
  } catch (error) {
    logger.error('Error adding to cart:', error);
    return errorResponse(res, error.message || 'Failed to add to cart', error, 500);
  }
};

/**
 * Update cart item quantity for authenticated user
 */
const updateCart = async (req, res) => {
  try {
    // Unified approach: use req.user for both guest and authenticated users
    const userContext = req.user ? { userId: req.userId } : null;
    
    if (!userContext) {
      return errorResponse(res, 'Authentication required for cart updates', null, 401);
    }

    const { productId, quantity, catalogId } = req.body;

    if (!productId) {
      return errorResponse(res, 'Product ID is required', null, 400);
    }

    const cart = await cartService.updateCart(userContext, productId, quantity, catalogId);
    
    logger.info(`Cart updated: ${productId} quantity ${quantity}, user ${req.userId} (${req.sessionType})`);
    return successResponse(res, cart, 'Cart updated successfully');
  } catch (error) {
    logger.error('Error updating cart:', error);
    return errorResponse(res, error.message || 'Failed to update cart', error, 500);
  }
};

/**
 * Remove item from cart for authenticated user
 */
const removeFromCart = async (req, res) => {
  try {
    // Unified approach: use req.user for both guest and authenticated users
    const userContext = req.user ? { userId: req.userId } : null;
    
    if (!userContext) {
      return errorResponse(res, 'Authentication required for cart modifications', null, 401);
    }

    const { productId } = req.params;

    if (!productId) {
      return errorResponse(res, 'Product ID is required', null, 400);
    }

    const cart = await cartService.removeFromCart(userContext, productId);
    
    logger.info(`Item removed from cart: ${productId}, user ${req.userId} (${req.sessionType})`);
    return successResponse(res, cart, 'Item removed from cart successfully');
  } catch (error) {
    logger.error('Error removing from cart:', error);
    return errorResponse(res, error.message || 'Failed to remove from cart', error, 500);
  }
};

/**
 * Get guest cart (no auth required)
 * Uses x-session-id header for session management
 */
// Legacy guest cart endpoint - kept for backward compatibility
const getGuestCart = async (req, res) => {
  try {
    // Get session ID from x-session-id header (new approach)
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || req.body.sessionId;
    
    if (!sessionId) {
      return errorResponse(res, 'Session ID required', null, 400);
    }

    // Ensure session ID is treated as guest session
    const guestSessionId = sessionId.startsWith('guest_') ? sessionId : `guest_${sessionId}`;
    const cart = await cartService.getCart(guestSessionId);
    
    logger.info(`Guest cart retrieved for session: ${guestSessionId}`);
    return successResponse(res, cart, 'Guest cart retrieved successfully');
  } catch (error) {
    logger.error('Error getting guest cart:', error);
    return errorResponse(res, error.message || 'Failed to get guest cart', error, 500);
  }
};

/**
 * Add item to guest cart (no auth required)
 * Uses x-session-id header for session management
 */
// Legacy guest cart endpoint - kept for backward compatibility
const addToGuestCart = async (req, res) => {
  try {
    // Get session ID from x-session-id header (new approach)
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || req.body.sessionId;
    
    if (!sessionId) {
      return errorResponse(res, 'Session ID required', null, 400);
    }

    // Ensure session ID is treated as guest session
    const guestSessionId = sessionId.startsWith('guest_') ? sessionId : `guest_${sessionId}`;
    const { productId, quantity, catalogId } = req.body;

    if (!productId) {
      return errorResponse(res, 'Product ID is required', null, 400);
    }

    const cart = await cartService.addToCart(guestSessionId, productId, quantity || 1, catalogId);
    
    logger.info(`Item added to guest cart: ${productId} from catalog ${catalogId}, session ${guestSessionId}`);
    return successResponse(res, cart, 'Item added to guest cart successfully');
  } catch (error) {
    logger.error('Error adding to guest cart:', error);
    return errorResponse(res, error.message || 'Failed to add to guest cart', error, 500);
  }
};

/**
 * Remove item from guest cart (no auth required)
 * Uses x-session-id header for session management
 */
// Legacy guest cart endpoint - kept for backward compatibility
const removeFromGuestCart = async (req, res) => {
  try {
    // Get session ID from x-session-id header (new approach)
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || req.body.sessionId;
    
    if (!sessionId) {
      return errorResponse(res, 'Session ID required', null, 400);
    }

    // Ensure session ID is treated as guest session
    const guestSessionId = sessionId.startsWith('guest_') ? sessionId : `guest_${sessionId}`;
    const { productId } = req.params;

    if (!productId) {
      return errorResponse(res, 'Product ID is required', null, 400);
    }

    const cart = await cartService.removeFromCart(guestSessionId, productId);
    
    logger.info(`Item removed from guest cart: ${productId}, session ${guestSessionId}`);
    return successResponse(res, cart, 'Item removed from guest cart successfully');
  } catch (error) {
    logger.error('Error removing from guest cart:', error);
    return errorResponse(res, error.message || 'Failed to remove from guest cart', error, 500);
  }
};

/**
 * Update guest cart item quantity (no auth required)
 * Uses x-session-id header for session management
 */
// Legacy guest cart endpoint - kept for backward compatibility
const updateGuestCart = async (req, res) => {
  try {
    // Get session ID from x-session-id header (new approach)
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || req.body.sessionId;
    
    if (!sessionId) {
      return errorResponse(res, 'Session ID required', null, 400);
    }

    // Ensure session ID is treated as guest session
    const guestSessionId = sessionId.startsWith('guest_') ? sessionId : `guest_${sessionId}`;
    const { productId, quantity, catalogId } = req.body;

    if (!productId) {
      return errorResponse(res, 'Product ID is required', null, 400);
    }

    const cart = await cartService.updateCart(guestSessionId, productId, quantity, catalogId);
    
    logger.info(`Guest cart updated: ${productId} quantity ${quantity}, session ${guestSessionId}`);
    return successResponse(res, cart, 'Guest cart updated successfully');
  } catch (error) {
    logger.error('Error updating guest cart:', error);
    return errorResponse(res, error.message || 'Failed to update guest cart', error, 500);
  }
};

/**
 * Get guest cart item count (no auth required)
 * Uses x-session-id header for session management
 */
// Legacy guest cart endpoint - kept for backward compatibility
const getGuestCartCount = async (req, res) => {
  try {
    // Get session ID from x-session-id header (new approach)
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || req.body.sessionId;
    
    if (!sessionId) {
      return errorResponse(res, 'Session ID required', null, 400);
    }

    // Ensure session ID is treated as guest session
    const guestSessionId = sessionId.startsWith('guest_') ? sessionId : `guest_${sessionId}`;
    const count = await cartService.getCartCount(guestSessionId);
    
    logger.info(`Guest cart count retrieved for session: ${guestSessionId}, count: ${count}`);
    return successResponse(res, { count }, 'Guest cart count retrieved successfully');
  } catch (error) {
    logger.error('Error getting guest cart count:', error);
    return errorResponse(res, error.message || 'Failed to get guest cart count', error, 500);
  }
};

/**
 * Clear guest cart (no auth required)
 * Uses x-session-id header for session management
 */
// Legacy guest cart endpoint - kept for backward compatibility
const clearGuestCart = async (req, res) => {
  try {
    // Get session ID from x-session-id header (new approach)
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || req.body.sessionId;
    
    if (!sessionId) {
      return errorResponse(res, 'Session ID required', null, 400);
    }

    // Ensure session ID is treated as guest session
    const guestSessionId = sessionId.startsWith('guest_') ? sessionId : `guest_${sessionId}`;
    const cart = await cartService.clearCart(guestSessionId);
    
    logger.info(`Guest cart cleared for session: ${guestSessionId}`);
    return successResponse(res, cart, 'Guest cart cleared successfully');
  } catch (error) {
    logger.error('Error clearing guest cart:', error);
    return errorResponse(res, error.message || 'Failed to clear guest cart', error, 500);
  }
};

/**
 * Migrate guest cart to user cart
 * Uses x-session-id header for session management
 */
const migrateGuestCart = async (req, res) => {
  try {
    // Get session ID from x-session-id header (new approach)
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || req.body.sessionId;
    const userId = req.body.userId || req.userId;

    if (!sessionId || !userId) {
      return errorResponse(res, 'Session ID and user ID required', null, 400);
    }

    // Ensure session ID is treated as guest session
    const guestSessionId = sessionId.startsWith('guest_') ? sessionId : `guest_${sessionId}`;
    const cart = await cartService.migrateGuestCart(guestSessionId, userId);
    
    logger.info(`Guest cart migrated from session ${guestSessionId} to user ${userId}`);
    return successResponse(res, cart, 'Guest cart migrated successfully');
  } catch (error) {
    logger.error('Error migrating guest cart:', error);
    return errorResponse(res, error.message || 'Failed to migrate guest cart', error, 500);
  }
};

export {
  getCart,
  addToCart,
  updateCart,
  removeFromCart,
  // Guest cart functions
  getGuestCart,
  addToGuestCart,
  removeFromGuestCart,
  updateGuestCart,
  getGuestCartCount,
  clearGuestCart,
  // Cart migration
  migrateGuestCart,
};