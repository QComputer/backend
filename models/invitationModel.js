import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema({
  // Invitation details
  token: { type: String, required: true, unique: true },
  type: { type: String, enum: ['staff', 'customer'], required: true },

  // Creator and association
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },

  // Usage tracking
  isUsed: { type: Boolean, default: false },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  usedAt: { type: Date },

  // Metadata
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes for better query performance
invitationSchema.index({ token: 1 });
invitationSchema.index({ createdBy: 1 });
invitationSchema.index({ storeId: 1 });
invitationSchema.index({ expiresAt: 1 });

const invitationModel = mongoose.models.invitation || mongoose.model("invitation", invitationSchema);

export default invitationModel;