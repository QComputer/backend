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
    new winston.transports.Console()
  ]
});

/**
 * Get cart for authenticated user
 */
const getCart = async (req, res) => {
  try {
    // Unified approach: use req.user for both guest and authenticated users
    let userContext;
    
    // Handle guest sessions from autoGuestLogin
    if (req.sessionType === 'guest' && req.userId) {
      userContext = { sessionId: req.userId };
    } else if (req.user && req.userId) {
      userContext = { userId: req.userId };
    } else {
      userContext = null;
    }
    
    if (!userContext) {
      return errorResponse(res, 'Authentication required', null, 401);
    }
 
    const cart = await cartService.getCart(userContext);
    
    // Add session information to response for frontend to track session-based carts
    const responseData = cart.toObject ? cart.toObject() : cart;
    
    if (req.sessionType === 'guest') {
      responseData.sessionId = req.userId;
      responseData.sessionType = 'guest';
      responseData.isGuestCart = true;
      
      // Set header for frontend to track session
      res.set('X-Session-Id', req.userId);
      res.set('X-Session-Type', 'guest');
    }
    
    logger.info(`Cart retrieved for ${req.sessionType || 'user'}: ${req.userId}`);
    return successResponse(res, responseData, 'Cart retrieved successfully');
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
    let userContext;
    
    // Handle guest sessions from autoGuestLogin
    if (req.sessionType === 'guest' && req.userId) {
      userContext = { sessionId: req.userId };
    } else if (req.user && req.userId) {
      userContext = { userId: req.userId };
    } else {
      userContext = null;
    }
    
    if (!userContext) {
      return errorResponse(res, 'Authentication required', null, 401);
    }
 
    const { productId, quantity, catalogId } = req.body;
 
    if (!productId) {
      return errorResponse(res, 'Product ID is required', null, 400);
    }
 
    const cart = await cartService.addToCart(userContext, productId, quantity || 1, catalogId);
    
    // Add session information to response for frontend to track session-based carts
    const responseData = cart.toObject ? cart.toObject() : cart;
    
    if (req.sessionType === 'guest') {
      responseData.sessionId = req.userId;
      responseData.sessionType = 'guest';
      responseData.isGuestCart = true;
      
      // Set header for frontend to track session
      res.set('X-Session-Id', req.userId);
      res.set('X-Session-Type', 'guest');
    }
    
    logger.info(`Item added to cart: ${productId} from catalog ${catalogId}, ${req.sessionType || 'user'}: ${req.userId}`);
    return successResponse(res, responseData, 'Item added to cart successfully');
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
    let userContext;
     
    // Handle guest sessions from autoGuestLogin
    if (req.sessionType === 'guest' && req.userId) {
      userContext = { sessionId: req.userId };
    } else if (req.user && req.userId) {
      userContext = { userId: req.userId };
    } else {
      userContext = null;
    }
     
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
    let userContext;
     
    // Handle guest sessions from autoGuestLogin
    if (req.sessionType === 'guest' && req.userId) {
      userContext = { sessionId: req.userId };
    } else if (req.user && req.userId) {
      userContext = { userId: req.userId };
    } else {
      userContext = null;
    }
     
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
// Cart migration
migrateGuestCart,
};