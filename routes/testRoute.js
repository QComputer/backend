/**
 * Test Route for Unified Authentication System
 * Provides endpoints to test and verify the unified guest/authenticated user system
 */

import express from "express";
import guestUserService from "../services/guestUserService.js";
import sessionModel from "../models/sessionModel.js";
import userModel from "../models/userModel.js";
import cartService from "../services/cartService.js";
import { unifiedAuth, guestCartMiddleware } from "../middleware/auth.js";

const testRouter = express.Router();

/**
 * Test endpoint to create a guest user manually
 * Useful for testing the guest user creation system
 */
testRouter.post("/create-guest", async (req, res) => {
  try {
    const metadata = {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer'],
      deviceType: req.body.deviceType || 'test'
    };

    const result = await guestUserService.getOrCreateGuestUser(null, metadata);

    res.json({
      success: true,
      message: "Guest user created successfully",
      data: {
        user: {
          _id: result.user._id,
          username: result.user.username,
          role: result.user.role,
          isTemporary: result.user.isTemporary
        },
        sessionId: result.sessionId,
        isNew: result.isNew
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create guest user",
      error: error.message
    });
  }
});

/**
 * Test endpoint to get guest user statistics
 */
testRouter.get("/guest-stats", async (req, res) => {
  try {
    const stats = await guestUserService.getGuestStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get guest stats",
      error: error.message
    });
  }
});

/**
 * Test endpoint to validate a guest user
 */
testRouter.get("/validate-guest/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const isValid = await guestUserService.validateGuestUser(userId);

    res.json({
      success: true,
      data: {
        userId,
        isValid
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to validate guest user",
      error: error.message
    });
  }
});

/**
 * Test endpoint to cleanup expired guest users
 */
testRouter.post("/cleanup-guests", async (req, res) => {
  try {
    const maxAgeHours = req.body.maxAgeHours || 48;
    const cleanedCount = await guestUserService.cleanupExpiredGuests(maxAgeHours);

    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired guest users`,
      data: {
        cleanedCount,
        maxAgeHours
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cleanup expired guests",
      error: error.message
    });
  }
});

/**
 * Test endpoint to simulate public catalog access
 * This will trigger the guest user creation system
 */
testRouter.get("/simulate-catalog-access/:catalogId", async (req, res) => {
  try {
    const { catalogId } = req.params;

    // Simulate the guest user creation that happens in catalog access
    const metadata = {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer'],
      deviceType: 'test'
    };

    const guestResult = await guestUserService.getOrCreateGuestUser(null, metadata);

    res.json({
      success: true,
      message: "Simulated catalog access with guest user creation",
      data: {
        guestUser: {
          _id: guestResult.user._id,
          username: guestResult.user.username
        },
        sessionId: guestResult.sessionId,
        isNew: guestResult.isNew,
        catalogId
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to simulate catalog access",
      error: error.message
    });
  }
});

/**
 * Test endpoint to get all guest users (for debugging)
 */
testRouter.get("/guest-users", async (req, res) => {
  try {
    const guestUsers = await userModel.find({
      role: 'guest',
      isTemporary: true
    }).select('_id username createdAt sessionExpiry metadata').sort({ createdAt: -1 });

    res.json({
      success: true,
      data: guestUsers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get guest users",
      error: error.message
    });
  }
});

/**
 * Test endpoint to validate unified authentication
 * Tests that guest sessions are treated as authenticated
 */
testRouter.get("/test-unified-auth", unifiedAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Unified authentication successful",
      data: {
        authenticated: req.authenticated,
        sessionType: req.sessionType,
        userId: req.userId,
        userRole: req.userRole,
        user: req.user ? {
          id: req.user.id,
          role: req.user.role,
          username: req.user.username
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unified auth test failed",
      error: error.message
    });
  }
});

/**
 * Test endpoint to validate unified cart operations
 * Tests that both guest and authenticated users can use the same cart API
 */
testRouter.get("/test-unified-cart", unifiedAuth, async (req, res) => {
  try {
    // Test cart operations with unified context
    const userContext = req.user ? { userId: req.userId } : null;

    if (!userContext) {
      return res.status(400).json({
        success: false,
        message: "No valid user context"
      });
    }

    const cart = await cartService.getCart(userContext);
    const cartCount = await cartService.getCartCount(userContext);

    res.json({
      success: true,
      message: "Unified cart operations successful",
      data: {
        authenticated: req.authenticated,
        sessionType: req.sessionType,
        userId: req.userId,
        cartItems: cart.items.length,
        cartCount: cartCount,
        cartId: cart._id
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unified cart test failed",
      error: error.message
    });
  }
});

/**
 * Test endpoint to compare old vs new authentication patterns
 */
testRouter.get("/compare-auth-patterns", async (req, res) => {
  try {
    const results = {
      unifiedAuth: null,
      guestCartMiddleware: null,
      sessionInfo: null
    };

    // Test unified auth (should work for all sessions)
    try {
      // Simulate unified auth check
      const sessionId = req.headers['x-session-id'] || req.cookies?.guest_session;
      if (sessionId) {
        const session = await sessionModel.findByToken(sessionId);
        if (session && !session.isExpired()) {
          results.unifiedAuth = {
            status: 'authenticated',
            sessionType: 'guest',
            userId: session.sessionId
          };
        }
      }
    } catch (error) {
      results.unifiedAuth = { status: 'error', error: error.message };
    }

    // Test legacy guest cart middleware
    try {
      if (req.headers['x-session-id']) {
        results.guestCartMiddleware = {
          status: 'would authenticate',
          sessionId: req.headers['x-session-id']
        };
      } else {
        results.guestCartMiddleware = { status: 'no session id' };
      }
    } catch (error) {
      results.guestCartMiddleware = { status: 'error', error: error.message };
    }

    // Session info
    results.sessionInfo = {
      hasSessionId: !!req.headers['x-session-id'],
      hasGuestCookie: !!req.cookies?.guest_session,
      hasAuthToken: !!req.headers.authorization,
      userAgent: req.headers['user-agent']?.substring(0, 50)
    };

    res.json({
      success: true,
      message: "Authentication pattern comparison",
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Auth pattern comparison failed",
      error: error.message
    });
  }
});

export default testRouter;