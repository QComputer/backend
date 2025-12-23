import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Category name must be at least 2 characters long'],
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  isGlobal: { type: Boolean, default: false },
  
  description: {
    type: String,
    default: "",
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  image: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Add indexes for better query performance
categorySchema.index({ store: 1 });
categorySchema.index({ name: 1 });
categorySchema.index({ store: 1, name: 1 }); // Compound for unique categories per store

const categoryModel = mongoose.models.category || mongoose.model("category", categorySchema);

export default categoryModel;