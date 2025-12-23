import mongoose from 'mongoose';

// Validation utility functions
export const validateObjectId = (id, fieldName = 'ID') => {
  if (!id) {
    throw new Error(`${fieldName} is required`);
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ${fieldName} format`);
  }
  return true;
};

export const validateRequired = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${fieldName} is required`);
  }
  return true;
};

export const validateStringLength = (value, fieldName, min = 0, max = Infinity) => {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  if (value.length < min) {
    throw new Error(`${fieldName} must be at least ${min} characters long`);
  }
  if (value.length > max) {
    throw new Error(`${fieldName} must be no more than ${max} characters long`);
  }
  return true;
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  return true;
};

export const validateRole = (role) => {
  const validRoles = ['customer', 'store', 'driver', 'admin'];
  if (!validRoles.includes(role)) {
    throw new Error('Invalid role. Must be one of: ' + validRoles.join(', '));
  }
  return true;
};

export const validatePhone = (phone) => {
  // Basic phone validation - allows international formats
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
    throw new Error('Invalid phone number format');
  }
  return true;
};

export const validatePassword = (password) => {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }
  return true;
};

export const validateUserRegistration = (data) => {
  const { username, password, role } = data;

  validateRequired(username, 'Username');
  validateStringLength(username, 'Username', 3, 50);

  validateRequired(password, 'Password');
  validatePassword(password);

  validateRequired(role, 'Role');
  validateRole(role);

  return true;
};

export const validateUserUpdate = (data) => {
  const { name, email, phone } = data;

  if (name !== undefined) {
    validateStringLength(name, 'Name', 1, 100);
  }

  if (email !== undefined && email !== '') {
    validateEmail(email);
  }

  if (phone !== undefined && phone !== '') {
    validatePhone(phone);
  }

  return true;
};

export const validateProductData = (data) => {
  const { name, price, description } = data;

  validateRequired(name, 'Product name');
  validateStringLength(name, 'Product name', 1, 200);

  if (price !== undefined) {
    if (typeof price !== 'number' || price < 0) {
      throw new Error('Price must be a positive number');
    }
  }

  if (description !== undefined) {
    validateStringLength(description, 'Description', 0, 1000);
  }

  return true;
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // Basic XSS prevention - remove script tags and other dangerous content
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .trim();
};

export const validateRequestBody = (req, requiredFields = []) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new Error('Request body is required');
  }

  for (const field of requiredFields) {
    if (!(field in req.body)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return true;
};

// Standardized error response utility
export const createErrorResponse = (message, statusCode = 400, details = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    response.details = details;
  }

  return { response, statusCode };
};

// Standardized success response utility
export const createSuccessResponse = (data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
  };

  if (data !== null) {
    response.data = data;
  }

  return { response, statusCode };
};

// Environment variable validation
export const validateEnvironmentVariables = () => {
  const requiredVars = [
    'JWT_SECRET',
    'MONGO_URI'
  ];

  const optionalVars = [
    'IMAGE_SERVER_URL',
    'STRIPE_SECRET_KEY',
    'PORT',
    'NODE_ENV'
  ];

  const missingRequired = [];
  const warnings = [];

  // Check required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingRequired.push(varName);
    }
  }

  // Check optional variables and provide warnings
  for (const varName of optionalVars) {
    if (!process.env[varName]) {
      warnings.push(`${varName} is not set (optional but recommended)`);
    }
  }

  if (missingRequired.length > 0) {
    throw new Error(`Missing required environment variables: ${missingRequired.join(', ')}`);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET is shorter than recommended (32+ characters)');
  }

  // Validate MONGO_URI format
  if (process.env.MONGO_URI && !process.env.MONGO_URI.startsWith('mongodb')) {
    warnings.push('MONGO_URI does not appear to be a valid MongoDB connection string');
  }

  return {
    valid: missingRequired.length === 0,
    warnings
  };
};