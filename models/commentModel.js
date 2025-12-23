import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true },
    text: { type: String, required: true },
    rating: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Add indexes for better query performance
commentSchema.index({ user: 1 });
commentSchema.index({ product: 1 });
commentSchema.index({ user: 1, product: 1 });

const commentModel =
  mongoose.models.comment || mongoose.model("comment", commentSchema);

export default commentModel;