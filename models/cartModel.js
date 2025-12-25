import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  catalog: { type: mongoose.Schema.Types.ObjectId, ref: 'catalog' }, // Optional for products not in catalogs
  quantity: { type: Number, required: true, min: 1 },
  addedAt: { type: Date, default: Date.now }
});

// Main cart schema that can be used for both authenticated users and guests
const cartSchema = new mongoose.Schema({
  // For authenticated users
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  // For guest users (session-based)
  sessionId: { type: String },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'session' },

  items: [cartItemSchema],

  // Legacy cart data (for backward compatibility)
  legacyCartData: { type: mongoose.Schema.Types.Mixed },

  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure either userId or sessionId is present
cartSchema.pre('validate', function (next) {
  if (!this.user && !this.sessionId && !this.session) {
    next(new Error('Either userId or sessionId must be provided'));
  }
  next();
});

// Set expiration for guest carts
cartSchema.pre('save', function (next) {
  // Set expiration for guest carts (24 hours)
  if (this.session && !this.user && !this.expiresAt) {
    if (this.session.expiresAt) {
      this.expiresAt = this.session.expiresAt
    } else {
      const expirationHours = parseInt(process.env.GUEST_SESSION_EXPIRATION_HOURS) || 24;
      this.expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);
      this.session.expiresAt = this.expiresAt;
    }
  }
  next();
});

// Method to check if cart is expired
cartSchema.methods.isExpired = function () {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Indexes for performance
cartSchema.index({ user: 1 });
cartSchema.index({ session: 1 });
cartSchema.index({ updatedAt: -1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Update the updatedAt field before saving
cartSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const cartModel = mongoose.models.cart || mongoose.model("cart", cartSchema);

export default cartModel;