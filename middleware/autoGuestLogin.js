import sessionModel from '../models/sessionModel.js';
import { standardError } from '../utils/apiUtils.js';

/**
 * Auto Guest Login Middleware
 * Automatically creates guest sessions for unauthenticated users accessing public routes
 * Ensures consistent experience between guest and authenticated users
 */
export const autoGuestLogin = async (req, res, next) => {
  try {
    // Skip if user is already authenticated with a valid session
    if (req.authenticated && req.user && req.sessionType !== 'anonymous') {
      console.log(`✅ User already authenticated: userId:${req.user.id} or sessionId:${req.sessionId} - sessionType:${req.sessionType}`);
      return next();
    }
    // Check for existing guest session from headers, cookies, or query params
    let sessionId = req.headers['x-session-id'] || req.cookies?.guest_session

    let session = null;

    // If session ID exists, try to find the session
    if (sessionId) {
      try {
        session = await sessionModel.findByToken(sessionId);

        if (session) {
          // Check if session is expired
          if (session.isExpired()) {
            console.log(`❌ Expired guest session found: ${sessionId}`);
            session = null;
          } else {
            console.log(`🔄 Reusing existing guest session: ${sessionId}`);
            // Refresh session expiration
            await session.extend();
          }
        } else {
          console.log(`❌ Guest session not found: ${sessionId}`);
        }
      } catch (error) {
        console.error(`❌ Error finding guest session ${sessionId}:`, error.message);
        session = null;
      }
    }

    // Create new guest session if none exists or if expired
    if (!session) {
      console.log('🆕 Creating new guest session for request:', {
        sessionId: sessionId || 'none',
        hasCookie: !!req.cookies?.guest_session,
        hasHeader: !!req.headers['x-session-id'],
        hasQuery: !!req.query?.session_id,
        hasBody: !!req.body?.sessionId
      });

      // Extract metadata from request
      const metadata = {
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'],
        deviceType: getDeviceType(req.headers['user-agent'])
      };

      // Create guest session directly
      session = await sessionModel.createGuestSession(metadata);

      // Set session cookie for backward compatibility
      res.cookie('guest_session', session.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined
      });

      console.log(`🔐 New guest session created: ${session.sessionId}`);
    }

    // Attach session information to request
    req.guestSession = session;
    req.sessionId = session.sessionId;
    req.sessionToken = session.token;
    req.isGuest = session.isGuest;

    // For backward compatibility with existing guest cart endpoints
    req.headers['x-session-id'] = session.sessionId;

    // Set unified authentication flags
    req.authenticated = true; // Guest sessions are now considered authenticated
    req.sessionType = 'guest';
    req.userRole = 'guest';
    req.userId = null;
    req.sessionId = session.sessionId;
    req.user = {
      id: null,
      session: session,
      role: 'guest',
      username: `guest_${session.sessionId.substring(0, 8)}`,
      isTemporary: true
    };

    console.log(`🔄 Guest session unified: ${session.sessionId} as authenticated guest for user ${req.user.username}`);

    // Continue to next middleware
    next();

  } catch (error) {
    console.error('❌ Auto guest login error:', error.message);
    res.status(500).json(
      standardError('Internal server error during session setup', error.message, 500)
    );
  }
};

/**
 * Helper function to determine device type from user agent
 */
function getDeviceType(userAgent) {
  if (!userAgent) return 'unknown';

  const userAgentLower = userAgent.toLowerCase();

  if (userAgentLower.includes('mobile') || userAgentLower.includes('android') ||
    userAgentLower.includes('iphone') || userAgentLower.includes('ipad')) {
    return 'mobile';
  }

  if (userAgentLower.includes('tablet')) {
    return 'tablet';
  }

  return 'desktop';
}

/**
 * Middleware to ensure guest session is valid
 * Used for guest-specific operations
 */
export const requireGuestSession = async (req, res, next) => {
  try {
    // Check for valid guest session - now unified approach
    if (!req.guestSession || req.guestSession.isExpired()) {
      return res.status(401).json(
        standardError('Valid guest session required', null, 401)
      );
    }

    // Check if user is authenticated as guest
    if (!req.authenticated || req.sessionType !== 'guest') {
      return res.status(403).json(
        standardError('Guest session required for this endpoint', null, 403)
      );
    }

    // Session is valid, continue
    next();

  } catch (error) {
    console.error('❌ Guest session validation error:', error.message);
    res.status(500).json(
      standardError('Internal server error during session validation', error.message, 500)
    );
  }
};

/**
 * Middleware to handle session migration when guest logs in
 * Merges guest cart with user cart and invalidates guest session
 */
export const migrateGuestSession = async (req, res, next) => {
  try {
    // This middleware should only run when a guest is logging in/registering
    const isGuestLogin = req.body?.isGuestLogin || false;

    if (!isGuestLogin || !req.guestSession) {
      return next();
    }

    console.log(`🔄 Migrating guest session ${req.guestSession.sessionId} to user ${req.user.id}`);

    // Import cart model dynamically to avoid circular dependencies
    const cartModel = (await import('../models/cartModel.js')).default;

    // Find guest cart
    const guestCart = await cartModel.findOne({
      sessionId: req.guestSession.sessionId
    }).populate('items.product items.store items.catalog');

    if (guestCart) {
      // Find or create user cart
      let userCart = await cartModel.findOne({ user: req.user.id });

      if (!userCart) {
        userCart = new cartModel({
          user: req.user.id,
          items: []
        });
      }

      // Merge cart items
      guestCart.items.forEach(guestItem => {
        const existingItemIndex = userCart.items.findIndex(userItem =>
          userItem.product.equals(guestItem.product) &&
          userItem.store.equals(guestItem.store)
        );

        if (existingItemIndex >= 0) {
          // Update quantity if item already exists
          userCart.items[existingItemIndex].quantity += guestItem.quantity;
        } else {
          // Add new item to user cart
          userCart.items.push({
            product: guestItem.product,
            store: guestItem.store,
            catalog: guestItem.catalog,
            quantity: guestItem.quantity,
            addedAt: new Date()
          });
        }
      });

      // Save merged cart
      await userCart.save();

      // Delete guest cart
      await cartModel.deleteOne({ _id: guestCart._id });

      console.log(`🛒 Merged ${guestCart.items.length} items from guest cart to user cart`);
    }

    // Invalidate guest session
    await sessionModel.deleteOne({ _id: req.guestSession._id });

    // Clear guest session cookie
    res.clearCookie('guest_session');

    console.log(`🗑️  Invalidated guest session ${req.guestSession.sessionId}`);

    // Continue with normal login flow
    next();

  } catch (error) {
    console.error('❌ Guest session migration error:', error.message);
    // Don't fail login if migration fails, just log and continue
    next();
  }
};