import mongoose from "mongoose"
import cartModel from "./cartModel.js";

const userSchema = new mongoose.Schema({
    // Status
    statusMain: { type: String, enum: ['online', 'offline', 'busy', 'soon'] },
    role: { type: String, enum: ['admin', 'store', 'customer', 'driver', 'staff'] },
    statusCustom: { type: String, default: "" },
    //cart: { type: mongoose.Schema.Types.ObjectId, ref: 'cart' },
    // Staff-Store association (for staff role)
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },

    // Invitation tracking
    invitationToken: { type: String },
    invitationType: { type: String, enum: ['staff', 'customer'] },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    invitationUsed: { type: Boolean, default: false },
    isConnect: { type: Boolean, default: false },
    isOpen: { type: Boolean, default: false },
    showOnlineStatus: { type: String, enum: ['everyone', 'friends', 'followers', 'none'], default: 'everyone' },
    
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    moreInfo: { type: String, default: "" },
    avatar: { type: String, default: "" },
    image: { type: String, default: "" },
    // Original images (admin access only)
    avatarOriginal: { type: String, default: "" },
    imageOriginal: { type: String, default: "" },
    // Image positioning and crop data
    avatarCrop: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      width: { type: Number, default: 100 },
      height: { type: Number, default: 100 }
    },
    imagePositioning: {
      // Cover image positioning for different screen sizes
      mobile: {
        cropX: { type: Number, default: 0 },
        cropY: { type: Number, default: 0 },
        cropWidth: { type: Number, default: 100 },
        cropHeight: { type: Number, default: 100 },
        zoom: { type: Number, default: 1 }
      },
      tablet: {
        cropX: { type: Number, default: 0 },
        cropY: { type: Number, default: 0 },
        cropWidth: { type: Number, default: 100 },
        cropHeight: { type: Number, default: 100 },
        zoom: { type: Number, default: 1 }
      },
      desktop: {
        cropX: { type: Number, default: 0 },
        cropY: { type: Number, default: 0 },
        cropWidth: { type: Number, default: 100 },
        cropHeight: { type: Number, default: 100 },
        zoom: { type: Number, default: 1 }
      }
    },
    avatarOnCoverPosition: {
      // Avatar positioning on cover for different screen sizes
      mobile: {
        x: { type: Number, default: 50 }, // percentage from left
        y: { type: Number, default: 50 }  // percentage from top
      },
      tablet: {
        x: { type: Number, default: 50 },
        y: { type: Number, default: 50 }
      },
      desktop: {
        x: { type: Number, default: 50 },
        y: { type: Number, default: 50 }
      }
    },
    locationLat: { type: Number },
    locationLng: { type: Number },
    shareLocation: { type: Boolean, default: false },
    
    lastOnline: { type: Date, default: Date.now },
    nextOnline: { type: Date },
    nextOffline: { type: Date },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'product' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, { minimize: false });

// Add indexes for better query performance
userSchema.index({ role: 1 });
userSchema.index({ statusMain: 1 });
userSchema.index({ showOnlineStatus: 1 });
userSchema.index({ locationLat: 1, locationLng: 1 }); // For location-based queries
userSchema.index({ favorites: 1 }); // For favorite queries

// Pre-save hook to automatically create cart for customer users
userSchema.pre('save', async function(next) {
  // Only create cart for new customer users
  if (this.isNew && this.role === 'customer') {
    try {
      // Create a new cart for this user
      const newCart = new cartModel({
        user: this._id,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Save the cart
      await newCart.save();
      
      // Set the cart reference on the user
      this.cart = newCart._id;
      
      console.log(`✅ Automatically created cart ${newCart._id} for new customer user ${this._id}`);
    } catch (error) {
      console.error('❌ Error creating automatic cart for user:', error.message);
      // Don't fail user creation if cart creation fails
      next();
    }
  }
  next();
});

const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;