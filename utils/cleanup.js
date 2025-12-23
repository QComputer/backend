import mongoose from 'mongoose';
import userModel from '../models/userModel.js';
import catalogModel from '../models/catalogModel.js';
import productModel from '../models/productModel.js';
import orderModel from '../models/orderModel.js';
import cartModel from '../models/cartModel.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/cleanup.log' })
  ]
});

/**
 * Regular cleanup recommendations and utilities
 */

// Remove inactive guest users older than specified days
export const cleanupOldGuestUsers = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await userModel.deleteMany({
      role: 'guest',
      createdAt: { $lt: cutoffDate },
      // Don't delete guests with recent activity
      updatedAt: { $lt: cutoffDate }
    });

    logger.info(`Cleaned up ${result.deletedCount} old guest users`);
    return result.deletedCount;
  } catch (error) {
    logger.error('Error cleaning up old guest users:', error);
    throw error;
  }
};

// Remove expired sessions from carts
export const cleanupExpiredSessions = async () => {
  try {
    // Remove carts with sessionId that haven't been updated in 7 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const result = await cartModel.deleteMany({
      sessionId: { $exists: true },
      updatedAt: { $lt: cutoffDate }
    });

    logger.info(`Cleaned up ${result.deletedCount} expired guest cart sessions`);
    return result.deletedCount;
  } catch (error) {
    logger.error('Error cleaning up expired sessions:', error);
    throw error;
  }
};

// Remove unused products (no orders, not in any catalogs)
export const cleanupUnusedProducts = async () => {
  try {
    // Find products not referenced in any orders or catalogs
    const productsInOrders = await orderModel.distinct('items.productId');
    const productsInCatalogs = await catalogModel.distinct('products');
    const featuredInCatalogs = await catalogModel.distinct('featuredProducts');

    const usedProductIds = [...new Set([...productsInOrders, ...productsInCatalogs, ...featuredInCatalogs])];

    const result = await productModel.deleteMany({
      _id: { $nin: usedProductIds },
      available: false // Only remove unavailable products
    });

    logger.info(`Cleaned up ${result.deletedCount} unused products`);
    return result.deletedCount;
  } catch (error) {
    logger.error('Error cleaning up unused products:', error);
    throw error;
  }
};

// Remove old analytics data (keep only last 90 days)
export const cleanupOldAnalytics = async () => {
  try {
    // This would be implemented if we had time-series analytics
    // For now, just log that this feature is available
    logger.info('Old analytics cleanup: Feature available for future implementation');
    return 0;
  } catch (error) {
    logger.error('Error cleaning up old analytics:', error);
    throw error;
  }
};

// Comprehensive cleanup function
export const performRegularCleanup = async () => {
  try {
    logger.info('Starting regular cleanup...');

    const results = {
      oldGuests: await cleanupOldGuestUsers(),
      expiredSessions: await cleanupExpiredSessions(),
      unusedProducts: await cleanupUnusedProducts(),
      oldAnalytics: await cleanupOldAnalytics()
    };

    const totalCleaned = Object.values(results).reduce((sum, count) => sum + count, 0);

    logger.info(`Regular cleanup completed. Total items cleaned: ${totalCleaned}`, results);
    return results;
  } catch (error) {
    logger.error('Error performing regular cleanup:', error);
    throw error;
  }
};

// Database optimization recommendations
export const getOptimizationRecommendations = () => {
  return {
    indexes: [
      'Ensure all frequently queried fields have proper indexes',
      'Monitor slow queries and add compound indexes as needed',
      'Consider partial indexes for filtered queries'
    ],
    cleanup: [
      'Run cleanupOldGuestUsers() weekly',
      'Run cleanupExpiredSessions() daily',
      'Run cleanupUnusedProducts() monthly',
      'Monitor database size and implement archiving for old data'
    ],
    performance: [
      'Use lean() queries when you don\'t need mongoose methods',
      'Implement pagination for large result sets',
      'Consider read replicas for heavy read operations',
      'Use aggregation pipelines for complex queries'
    ],
    maintenance: [
      'Regularly review and remove unused model fields',
      'Keep schema versions documented',
      'Implement proper error handling and logging',
      'Regular backup and restore testing'
    ]
  };
};

// Health check for database
export const checkDatabaseHealth = async () => {
  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();

    const collections = await db.listCollections().toArray();
    const collectionStats = {};

    for (const collection of collections) {
      const collStats = await db.collection(collection.name).stats();
      collectionStats[collection.name] = {
        count: collStats.count,
        size: collStats.size,
        indexes: collStats.nindexes
      };
    }

    return {
      database: {
        name: stats.db,
        collections: stats.collections,
        size: stats.dataSize,
        indexes: stats.indexes
      },
      collections: collectionStats,
      recommendations: getOptimizationRecommendations()
    };
  } catch (error) {
    logger.error('Error checking database health:', error);
    throw error;
  }
};