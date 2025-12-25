/**
 * Unified Authentication and Authorization Middleware
 * Consolidates all authentication logic into a single, configurable middleware
 */

import jwt from 'jsonwebtoken';
import { standardError } from '../utils/apiUtils.js';
import { errorResponse, unauthorizedResponse, forbiddenResponse } from '../utils/apiResponse.js';

/**
 * Combined authentication and authorization middleware
 * @param {Object} options - Configuration options
 */
export const authAndAuthorize = (options = {}) => {
  return authMiddleware(options);
};

/**
 * Unified authentication middleware with configurable options
 * @param {Object} options - Configuration options
 * @param {boolean} options.requireAuth - Whether authentication is required (default: true)
 * @param {Array} options.allowedRoles - Array of allowed roles (default: [])
 * @param {boolean} options.allowGuest - Whether to allow guest sessions (default: false)
 * @param {string} options.sessionType - Type of session to check ('user' | 'guest' | 'both') (default: 'user')
 * @returns {Function} Express middleware function
 */
export const authMiddleware = (options = {}) => {
  const {
    requireAuth = true,
    allowedRoles = [],
    allowGuest = false,
  } = options;

  return async (req, res, next) => {
    try {
      // Extract token from multiple possible locations
      let token = req.headers?.token ||
                 req.headers?.authorization ||
                 req.headers['x-access-token'] ||
                 req.query?.token ||
                 req.body.token;

      // Clean up token format
      if (token && typeof token === 'string') {
        if (token.startsWith('Bearer ')) {
          token = token.slice(7).trim();
        } else if (token.startsWith('Token ') || token.startsWith('JWT ')) {
          token = token.split(' ')[1];
        }
      }

      let authResult = null;

      // Try user authentication first
      if (token) {
        authResult = await validateUserToken(token);
      }

      // If user auth failed and guest is allowed, try guest session
      if (!authResult && allowGuest) {
        authResult = await validateGuestSession(req);
      }

      // Handle authentication result - UNIFIED APPROACH
      // All valid sessions (guest or user) are now considered authenticated
      if (authResult) {
        req.user = authResult.user || null;
        req.userId = authResult.userId || null;
        req.sessionId = authResult.sessionId || null;
        req.userRole = authResult.role;
        req.token = authResult.token;
        req.authenticated = true; // ALL valid sessions are authenticated
        req.isGuest = !!authResult.isGuest;

        // Log successful authentication with enhanced monitoring
        const logData = {
          userId: authResult.userId || 'not registered',
          sessionId: authResult.sessionId || 'not a guest session',
          method: req.method,
          path: req.originalUrl || req.path,
          ip: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent']?.substring(0, 100),
          timestamp: new Date().toISOString()
        };

        console.log(`🔐 Auth successful: ${JSON.stringify(logData)}`);

        // Add to request for potential analytics
        req.authLog = logData;
      } else if (allowGuest && !requireAuth) {
        // For routes that allow guests but don't require auth, create anonymous session
        req.user = { id: 'anonymous', role: 'anonymous' };
        req.userRole = 'anonymous';
        req.userId = 'anonymous';
        req.token = null;
        req.authenticated = false; // Anonymous users remain unauthenticated
        req.sessionType = 'anonymous';
        
        console.log(`🔄 Anonymous session created for ${req.method} ${req.originalUrl || req.path}`);
      } else if (requireAuth) {
        // Authentication required but failed
        return unauthorizedResponse(res, 'Authentication required');
      } else {
        // Authentication not required, continue as unauthenticated
        req.authenticated = false;
        req.sessionType = 'anonymous';
      }

      // Check role authorization if user is authenticated and roles are specified
      if (req.authenticated && allowedRoles.length > 0) {
        const userRole = req.userRole || req.user?.role;
        
        if (!allowedRoles.includes(userRole)) {
          return forbiddenResponse(res, `Access denied. Requires one of: ${allowedRoles.join(', ')}`);
        }
      }

      next();
    } catch (error) {
      console.error('❌ Authentication middleware error:', error.message);
      return errorResponse(res, 'Authentication failed', error.message, 500);
    }
  };
};

/**
 * Validate JWT token for user authentication
 * @param {string} token - JWT token
 * @returns {Object|null} User object if valid, null if invalid
 */
async function validateUserToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      user: decoded,
      role: decoded.role,
      userId: decoded.id,
      token: token,
    };
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    return null;
  }
}

/**
 * Validate guest session
 * @param {Object} req - Express request object
 * @returns {Object|null} Guest session object if valid, null if invalid
 */
async function validateGuestSession(req) {
  try {
    // Get session ID from x-session-id header (new approach)
    const guestSessionId = req.headers['x-session-id'] ||
                          req.headers['guest-session-id'] ||
                          req.query.sessionId ||
                          req.body.sessionId ||
                          req.cookies?.guest_session; // Keep for backward compatibility

    if (!guestSessionId) {
      return null;
    }

    // Import session model dynamically to avoid circular dependencies
    const sessionModel = (await import('../models/sessionModel.js')).default;
    
    // Find and validate the guest session
    const session = await sessionModel.findByToken(guestSessionId);
    
    if (!session || session.isExpired()) {
      return null;
    }

    // Generate JWT token for guest session to maintain consistency
    const jwtModule = await import('jsonwebtoken');
    const jwt = jwtModule.default;
    const token = jwt.sign(
      {
        sessionId: session.sessionId,
        role: 'guest',
        isGuest: true,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      process.env.JWT_SECRET
    );

    return {
      isGuest: true,
      role: 'guest',
      sessionId: session.sessionId,
      token: token,
    };
  } catch (error) {
    console.error('❌ Guest session validation failed:', error.message);
    return null;
  }
}

/**
 * Admin-only authorization middleware
 */
export const adminOnly = authMiddleware({
  requireAuth: true,
  allowedRoles: ['admin'],
  allowGuest: false
});

/**
 * Customer authorization middleware
 */
export const customerOnly = authMiddleware({
  requireAuth: true,
  allowedRoles: ['customer','admin'],
  allowGuest: false
});

/**
 * Driver authorization middleware
 */
export const driverOnly = authMiddleware({
  requireAuth: true,
  allowedRoles: ['driver','admin'],
  allowGuest: false
});

/**
 * Store owner authorization middleware
 */
export const storeOnly = authMiddleware({
  requireAuth: true,
  allowedRoles: ['store', 'admin'],
  allowGuest: false
});

/**
 * Staff authorization middleware (admin or store)
 */
export const staffOnly = authMiddleware({
  requireAuth: true,
  allowedRoles: ['admin', 'store', 'staff', 'driver'],
  allowGuest: false
});

/**
 * User or guest middleware (allows both authenticated users and guests)
 * UNIFIED: Both guest and user sessions are treated as authenticated
 */
export const userOrGuest = authMiddleware({
  requireAuth: false,
  allowedRoles: [],
  allowGuest: true,
});

/**
 * Owner authorization middleware (checks if user owns the resource)
 * @param {string} resourceField - Field name for owner ID in the resource (default: 'user')
 */
export const ownerOnly = (resourceField = 'user') => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.authenticated || !req.user) {
        return unauthorizedResponse(res, 'Authentication required');
      }

      // Get the resource ID from request
      const resourceId = req.params.id;

      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Resource ID not provided',
          timestamp: new Date().toISOString()
        });
      }

      // Find the resource and check ownership
      // This is a generic implementation - specific controllers may need to adjust
      const resource = await req.model?.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found',
          timestamp: new Date().toISOString()
        });
      }

      // Check ownership
      const ownerId = resource[resourceField]?._id || resource[resourceField];
      const currentUserId = req.userId || req.user?._id;

      if (String(ownerId) !== String(currentUserId)) {
        return forbiddenResponse(res, 'Access denied. You do not own this resource');
      }

      // User is authorized as owner
      next();
    } catch (error) {
      console.error('❌ Owner authorization error:', error.message);
      return errorResponse(res, 'Authorization failed', error.message, 500);
    }
  };
};

/**
 * Role-based authorization middleware factory
 * @param {Array} roles - Array of allowed roles
 */
export const authorizeRoles = (roles) => {
  return authMiddleware({
    requireAuth: true,
    allowedRoles: roles,
    allowGuest: false
  });
};

/**
 * User cart middleware (specific for authenticated user cart operations)
 * Now unified to work with both guest and user sessions
 */
export const userCartMiddleware = authMiddleware({
  requireAuth: false, // Changed to false to allow guest sessions
  allowedRoles: ['customer', 'store', 'admin', 'guest'], // Added guest role
  allowGuest: true,
});
