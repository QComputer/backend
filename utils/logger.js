// Simple logger utility for seeding
const logger = {
  info: (message, ...args) => console.log(`ℹ️  INFO: ${message}`, ...args),
  warn: (message, ...args) => console.warn(`⚠️  WARN: ${message}`, ...args),
  error: (message, ...args) => console.error(`❌ ERROR: ${message}`, ...args),
  success: (message, ...args) => console.log(`✅ SUCCESS: ${message}`, ...args)
};

export default logger;