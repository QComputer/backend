import mongoose from 'mongoose';

const themeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['website', 'catalog'],
    default: 'website'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  colorScheme: {
    primary: { type: String, default: '#007bff' },
    secondary: { type: String, default: '#6c757d' },
    success: { type: String, default: '#28a745' },
    danger: { type: String, default: '#dc3545' },
    warning: { type: String, default: '#ffc107' },
    info: { type: String, default: '#17a2b8' },
    light: { type: String, default: '#f8f9fa' },
    dark: { type: String, default: '#343a40' }
  },
  typography: {
    headingFont: { type: String, default: 'Arial, sans-serif' },
    bodyFont: { type: String, default: 'Arial, sans-serif' },
    baseFontSize: { type: String, default: '16px' },
    headingScale: { type: Number, default: 1.25 },
    lineHeight: { type: Number, default: 1.5 }
  },
  layout: {
    containerWidth: { type: String, default: '1200px' },
    sidebarWidth: { type: String, default: '250px' },
    gridColumns: { type: Number, default: 3 },
    spacing: { type: String, default: '16px' },
    borderRadius: { type: String, default: '8px' },
    cardShadow: { type: Boolean, default: true },
    animations: { type: Boolean, default: true }
  },
  customCSS: {
    type: String,
    default: ''
  },
  customJS: {
    type: String,
    default: ''
  },
  header: {
    backgroundColor: { type: String, default: '#ffffff' },
    textColor: { type: String, default: '#333333' },
    height: { type: String, default: '70px' },
    isSticky: { type: Boolean, default: true },
    logo: {
      url: { type: String, default: '' },
      alt: { type: String, default: '' }
    }
  },
  footer: {
    backgroundColor: { type: String, default: '#f8f9fa' },
    textColor: { type: String, default: '#6c757d' },
    linkColor: { type: String, default: '#007bff' },
    copyright: {
      text: { type: String, default: '© 2024 All rights reserved.' },
      year: { type: Number, default: () => new Date().getFullYear() }
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  }
}, {
  timestamps: true
});

// Ensure only one default theme per type
themeSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { type: this.type, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

// Index for efficient queries
themeSchema.index({ type: 1, isActive: 1 });
themeSchema.index({ isDefault: 1 });

const themeModel = mongoose.model('Theme', themeSchema);

export default themeModel;