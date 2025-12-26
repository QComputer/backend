import mongoose from "mongoose";

/**
 * Session Schema for managing both guest and authenticated user sessions
 * with automatic expiration and cleanup capabilities
 */
const sessionSchema = new mongoose.Schema({
  /**
   * Unique session identifier
   * Used as the primary key for session lookup
   */
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  /**
   * JWT token associated with this session
   */
  token: {
    type: String,
    required: true
  },

  /**
   * Session expiration timestamp
   * Used with TTL index for automatic cleanup
   */
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },

  /**
   * Flag to identify guest sessions
   */
  isGuest: {
    type: Boolean,
    default: false
  },

  /**
   * Session creation timestamp
   */
  createdAt: {
    type: Date,
    default: Date.now
  },

  /**
   * Last activity timestamp
   */
  updatedAt: {
    type: Date,
    default: Date.now
  },

  /**
   * Additional session metadata
   */
  metadata: {
    ipAddress: String,
    userAgent: String,
    referrer: String,
    deviceType: String
  },

  /**
   * Cart reference for this session
   * Allows quick access to session cart data
   */
  cartId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'cart',
    default: null
  }

}, {
  // Enable timestamps for automatic createdAt/updatedAt management
  timestamps: true
});

// Unified pre-save hook for session management
sessionSchema.pre('save', async function(next) {
  try {
    // Set default expiration for guest sessions (24 hours)
    if (this.isGuest && !this.expiresAt) {
      const expirationHours = parseInt(process.env.GUEST_SESSION_EXPIRATION_HOURS) || 24;
      this.expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);
    }
    
    // Automatically create cart for new guest sessions
    if (this.isNew && this.isGuest) {
      // Import cartModel dynamically to avoid circular dependency
      const cartModel = (await import('./cartModel.js')).default;
      
      // Create a new cart for this guest session
      const newCart = new cartModel({
        sessionId: this.sessionId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: this.expiresAt // Use same expiration as session
      });
      
      // Save the cart
      await newCart.save();
      
      // Set the cart reference on the session
      this.cartId = newCart._id;
      
      console.log(`✅ Automatically created cart ${newCart._id} for new guest session ${this.sessionId}`);
    }
    
    next();
  } catch (error) {
    console.error('❌ Error in session pre-save hook:', error.message);
    // Don't fail session creation if cart creation fails
    next();
  }
});

// Method to check if session is expired
sessionSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Method to extend session (for authenticated users)
sessionSchema.methods.extend = function(hours = 24) {
  this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

// Static method to create a new guest session
sessionSchema.statics.createGuestSession = async function(metadata = {}) {
  const sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  const token = await this.generateGuestToken(sessionId);
  const expirationHours = parseInt(process.env.GUEST_SESSION_EXPIRATION_HOURS) || 24;
  const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

  const guestSession = new this({
    sessionId,
    token,
    isGuest: true,
    expiresAt,
    metadata: {
      ...metadata,
      createdAt: new Date()
    }
  });

  await guestSession.save();
  return guestSession;
};

// Static method to generate guest token
sessionSchema.statics.generateGuestToken = async function(sessionId) {
  const jwtModule = await import('jsonwebtoken');
  const jwt = jwtModule.default;
  const expirationHours = parseInt(process.env.GUEST_SESSION_EXPIRATION_HOURS) || 24;

  return jwt.sign(
    {
      sessionId,
      role: 'guest',
      isGuest: true,
      exp: Math.floor(Date.now() / 1000) + (expirationHours * 60 * 60)
    },
    process.env.JWT_SECRET
  );
};

// Static method to find session by token
sessionSchema.statics.findByToken = async function(token) {
  try {
    const jwtModule = await import('jsonwebtoken');
    const jwt = jwtModule.default;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.sessionId) {
      return this.findOne({ sessionId: decoded.sessionId });
    }

    return null;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
};

// Create TTL index for automatic cleanup of expired sessions
// This index will automatically remove documents where expiresAt < current time
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const sessionModel = mongoose.models.session || mongoose.model("session", sessionSchema);

export default sessionModel;