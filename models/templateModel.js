import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
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
    enum: ['catalog', 'website'],
    default: 'catalog'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  // Template structure matching catalogTemplates.js
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  },
  design: {
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
    customCSS: { type: String, default: '' }
  },
  header: {
    title: { type: String, default: '' },
    tagline: { type: String, default: '' },
    navigation: [{
      label: { type: String, required: true },
      url: { type: String, default: '#' },
      icon: { type: String, default: '' },
      isVisible: { type: Boolean, default: true },
      order: { type: Number, default: 0 }
    }],
    searchBar: {
      enabled: { type: Boolean, default: true },
      placeholder: { type: String, default: 'Search products...' },
      showFilters: { type: Boolean, default: true }
    },
    contactInfo: {
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      address: { type: String, default: '' }
    },
    socialLinks: [{ type: String }],
    language: { type: String, default: 'en' },
    currency: { type: String, default: 'IRT' },
    height: { type: String, default: '70px' },
    backgroundColor: { type: String, default: '#ffffff' },
    textColor: { type: String, default: '#333333' },
    isSticky: { type: Boolean, default: true },
    isVisible: { type: Boolean, default: true }
  },
  footer: {
    description: { type: String, default: '' },
    quickLinks: [{
      label: { type: String, required: true },
      url: { type: String, default: '#' },
      isVisible: { type: Boolean, default: true }
    }],
    categories: [{ type: String }],
    contactInfo: {
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
      workingHours: { type: String, default: '' }
    },
    socialLinks: [{ type: String }],
    copyright: {
      text: { type: String, default: '© 2024 All rights reserved.' },
      year: { type: Number, default: () => new Date().getFullYear() }
    },
    backgroundColor: { type: String, default: '#f8f9fa' },
    textColor: { type: String, default: '#6c757d' },
    linkColor: { type: String, default: '#007bff' },
    isVisible: { type: Boolean, default: true }
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

// Ensure only one default template per type
templateSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { type: this.type, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

// Index for efficient queries
templateSchema.index({ type: 1, isActive: 1 });
templateSchema.index({ isDefault: 1 });

const templateModel = mongoose.model('Template', templateSchema);

export default templateModel;