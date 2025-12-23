import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Product name must be at least 2 characters long'],
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'category' },
  categoryGlobal: { type: mongoose.Schema.Types.ObjectId, ref: 'category' },

  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  currency: { type: String, enum: ['IRT', 'USD'], default: 'IRT' },
  ratings: { type: Number, default: 0, min: 0, max: 5 },
  image: { type: String },
  reactions: {
    likes: { type: Number, default: 0, min: 0 },
    dislikes: { type: Number, default: 0, min: 0 },
    love: { type: Number, default: 0, min: 0 },
    laugh: { type: Number, default: 0, min: 0 },
    angry: { type: Number, default: 0, min: 0 },
    sad: { type: Number, default: 0, min: 0 }
  },
  available: { type: Boolean, default: true },
  label: {
    type: String,
    maxlength: [50, 'Label cannot exceed 50 characters']
  },
  tags: [{ type: String }], // For additional categorization
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative']
  }, // Quantity available
  weight: {
    type: String,
    maxlength: [50, 'Weight description cannot exceed 50 characters']
  }, // For physical products
  dimensions: {
    type: String,
    maxlength: [100, 'Dimensions description cannot exceed 100 characters']
  }, // For physical products
  brand: {
    type: String,
    maxlength: [50, 'Brand name cannot exceed 50 characters']
  }, // For branded products
  sku: {
    type: String,
    maxlength: [50, 'SKU cannot exceed 50 characters'],
    sparse: true // Allow multiple null values but enforce uniqueness for non-null
  }, // Stock Keeping Unit
  barcode: {
    type: String,
    maxlength: [50, 'Barcode cannot exceed 50 characters']
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes for better query performance
productSchema.index({ store: 1, category: 1 });
productSchema.index({ store: 1, categoryGlobal: 1 });
productSchema.index({ name: 'text', description: 'text' }); // Text search
productSchema.index({ available: 1 }); // For available products
productSchema.index({ price: 1 }); // For price sorting
productSchema.index({ tags: 1 }); // For tag-based searches
productSchema.index({ store: 1, available: 1 }); // Store products by availability
productSchema.index({ category: 1, available: 1 }); // Category products by availability

const productModel = mongoose.models.product || mongoose.model("product", productSchema);

export default productModel;