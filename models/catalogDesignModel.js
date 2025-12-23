import mongoose from "mongoose";

const catalogDesignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Design name must be at least 2 characters long'],
    maxlength: [100, 'Design name cannot exceed 100 characters']
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  layout: {
    type: String,
    enum: ['menu', 'grid', 'list', 'masonry', 'custom'],
    default: 'menu'
  },
  colorScheme: {
    primary: String,
    secondary: String,
    background: String,
    text: String
  },
  components: {
    showCategoryFilter: { type: Boolean, default: true },
    showPrice: { type: Boolean, default: true },
    showImage: { type: Boolean, default: true },
    showDescription: { type: Boolean, default: true },
    showAddToCart: { type: Boolean, default: true }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes for better query performance
catalogDesignSchema.index({ store: 1 });
catalogDesignSchema.index({ name: 1 });
catalogDesignSchema.index({ store: 1, name: 1 });

catalogDesignSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const catalogDesignModel = mongoose.models.catalogDesign || mongoose.model("catalogDesign", catalogDesignSchema);

export default catalogDesignModel;
