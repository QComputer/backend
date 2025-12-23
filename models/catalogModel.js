import mongoose from "mongoose";

const catalogSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Catalog name must be at least 2 characters long'],
    maxlength: [100, 'Catalog name cannot exceed 100 characters']
  },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  products: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true }
  }],
  isPublic: { type: Boolean, default: false },
  shareLink: { type: String },
  qrCode: { type: String },
  createdAt: { type: Date, default: Date.now },
  useCustomDesign: {type: Boolean, default: false},
});

// Add indexes for better query performance
catalogSchema.index({ store: 1 });
catalogSchema.index({ owner: 1 });
catalogSchema.index({ isPublic: 1 });
catalogSchema.index({ store: 1, isPublic: 1 });
catalogSchema.index({ owner: 1, isPublic: 1 });
catalogSchema.index({ name: 'text', description: 'text' });

const catalogModel = mongoose.models.catalog || mongoose.model("catalog", catalogSchema);

export default catalogModel;