import mongoose from "mongoose";

const productReactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true },
  reaction: { type: String, enum: ['like', 'dislike', 'love', 'laugh', 'angry', 'sad'], required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { minimize: false });

// Ensure one reaction per user per product
productReactionSchema.index({ user: 1, product: 1 }, { unique: true });

// Add indexes for better query performance
productReactionSchema.index({ product: 1, reaction: 1 });
productReactionSchema.index({ user: 1 });

const productReactionModel = mongoose.models.productReaction || mongoose.model("productReaction", productReactionSchema);

export default productReactionModel;