import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'user'  },

  guestSessionId: { type: String, default: null }, // For guest orders

  orderName: { type: String },

  idBlackList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],

  address_details: { type: String },
  deliveryLat: { type: Number },
  deliveryLng: { type: Number },
  phone: { type: String },

  items: { type: Array, required: true },
  amount: { type: Number, required: true },
  deliveryFee: { type: Number },
  currency: { type: String, enum: ['IRT', 'USD'], default: 'IRT' },
  payment: { type: Boolean, default: false, required: true },

  isTakeout: { type: Boolean, default: false, required: true },
  isActive: { type: Boolean, default: false, required: true },
  done: { type: Boolean, default: false, required: true },
  cancel: { type: Boolean, default: false, required: true },
  
  stateGiven: { type: String, enum: ['to-store', 'to-driver', 'to-customer'], default: 'to-store' },
  stateRejected: { type: String, enum: ['by-store', 'by-driver', 'by-customer'], default: null },
  stateReceived: { type: String, enum: ['by-store', 'by-driver', 'by-customer'], default: null },
  status: { type: String, enum: ['placed', 'accepted', 'prepared', 'pickedup', 'delivered', 'rejected'], default: 'placed' },

  minutesLeftPickup: { type: Number, default: null },
  minutesLeftPrepare: { type: Number, default: null },
  minutesLeftDeliver: { type: Number, default: null },
  progressPickup: { type: Number, default: 0, required: true },
  progressPrepare: { type: Number, default: 0, required: true },
  progressDeliver: { type: Number, default: 0, required: true },

  datePlaced: { type: Date, required: true }, // Initiate
  dateReceived_byCustomer: { type: Date, default: null }, // Done

  dateAccepted_byStore: { type: Date, default: null },
  dateRejected_byStore: { type: Date, default: null },
  datePrepared_byStore_est: { type: Date, default: null },
  datePrepared_byStore: { type: Date, default: null },
  dateDelivered_byStore: { type: Date, default: null },

  dateAccepted_byDriver: { type: Date, default: null },
  datePickedup_byDriver_est: { type: Date, default: null },
  datePickedup_byDriver: { type: Date, default: null },
  dateDelivered_byDriver_est: { type: Date, default: null },
  dateDelivered_byDriver: { type: Date, default: null },

  dateCanceled_byStore: { type: Date, default: null }, // Cancell
  dateCanceled_byDriver: { type: Date, default: null }, // Cancell
  dateCanceled_byCustomer: { type: Date, default: null }, // Cancell

  rating_toDriver_byCustomer: { type: Number, default: null },
  rating_toStore_byCustomer: { type: Number, default: null },
  rating_toStore_byDriver: { type: Number, default: null },
  rating_toCustomer_byDriver: { type: Number, default: null },
  rating_toCustomer_byStore: { type: Number, default: null },
  rating_toDriver_byStore: { type: Number, default: null },
  
  comments_onOrder_byCustomer: { type: Number, default: null },
  comments_onDriver_byCustomer: { type: Number, default: null },
  comments_onStore_byCustomer: { type: Number, default: null },
  comments_onStore_byDriver: { type: Number, default: null },
  comments_onCustomer_byDriver: { type: Number, default: null },
  comments_onCustomer_byStore: { type: Number, default: null },
  comments_onDriver_byStore: { type: Number, default: null },
  comments_onOrder_byCustomer: { type: Number, default: null },
  comments: { type: String, default: null },

  customerRating: { type: Number, min: 1, max: 5, default: null },
  customerComment: { type: String, default: null },
  customerReactions: [{ type: String, enum: ['like', 'dislike', 'love', 'angry', 'sad', 'laugh'] }],

  description: { type: String, default: null },
});

// PERFORMANCE OPTIMIZATION: Comprehensive indexes for optimal query performance
orderSchema.index({ user: 1 });
orderSchema.index({ store: 1 });
orderSchema.index({ catalog: 1 });
orderSchema.index({ driver: 1 });
orderSchema.index({ guestSessionId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ datePlaced: -1 }); // Descending for recent orders
orderSchema.index({ payment: 1 });
orderSchema.index({ isActive: 1 });
orderSchema.index({ done: 1 });
orderSchema.index({ cancel: 1 });

// Compound indexes for efficient multi-field queries
orderSchema.index({ user: 1, status: 1, datePlaced: -1 }); // User orders by status and date
orderSchema.index({ store: 1, datePlaced: -1, status: 1 }); // Store orders by date and status
orderSchema.index({ driver: 1, status: 1, datePlaced: -1 }); // Driver orders by status and date
orderSchema.index({ isActive: 1, done: 1, status: 1 }); // Active orders filtering
orderSchema.index({ isActive: 1, isTakeout: 1, stateGiven: 1 }); // Available orders for drivers
orderSchema.index({ idBlackList: 1, isActive: 1 }); // Blacklist filtering

// Time-based indexes for progress tracking
orderSchema.index({ dateAccepted_byStore: -1 });
orderSchema.index({ datePrepared_byStore_est: -1 });
orderSchema.index({ datePickedup_byDriver_est: -1 });
orderSchema.index({ dateDelivered_byDriver_est: -1 });

// State and workflow indexes
orderSchema.index({ stateGiven: 1, stateRejected: 1 });
orderSchema.index({ stateGiven: 1, stateReceived: 1 });

// Geographic indexes for location-based queries (if needed)
orderSchema.index({ deliveryLat: 1, deliveryLng: 1 });

// Partial indexes for better performance
orderSchema.index({ isActive: 1, done: 1 }, { 
  partialFilterExpression: { isActive: true } 
});

const orderModel =
  mongoose.models.order || mongoose.model("order", orderSchema);
export default orderModel;