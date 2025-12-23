/**
 * Order Service
 * Centralized order business logic and operations
 */

import orderModel from '../models/orderModel.js';
import cartModel from '../models/cartModel.js';
import userModel from '../models/userModel.js';
import productModel from '../models/productModel.js';
import { successResponse, errorResponse, notFoundResponse } from '../utils/apiResponse.js';

/**
 * Order Service Class
 * Handles all order-related business logic
 */
class OrderService {
  /**
   * Order status constants
   */
  static STATUSES = {
    PLACED: 'placed',
    ACCEPTED: 'accepted',
    PREPARED: 'prepared',
    PICKED_UP: 'pickedup',
    DELIVERED: 'delivered',
    RECEIVED: 'received',
    REJECTED: 'rejected',
    CANCELED_BY_CUSTOMER: 'canceled by customer',
    CANCELED_BY_STORE: 'canceled by store',
    CANCELED_BY_DRIVER: 'canceled by driver'
  };

  /**
   * Valid status transitions
   */
  static STATUS_TRANSITIONS = {
    [this.STATUSES.PLACED]: [this.STATUSES.ACCEPTED, this.STATUSES.REJECTED, this.STATUSES.CANCELED_BY_CUSTOMER],
    [this.STATUSES.ACCEPTED]: [this.STATUSES.PREPARED, this.STATUSES.CANCELED_BY_STORE],
    [this.STATUSES.PREPARED]: [this.STATUSES.PICKED_UP, this.STATUSES.CANCELED_BY_STORE],
    [this.STATUSES.PICKED_UP]: [this.STATUSES.DELIVERED, this.STATUSES.CANCELED_BY_DRIVER],
    [this.STATUSES.DELIVERED]: [this.STATUSES.RECEIVED],
    [this.STATUSES.RECEIVED]: [],
    [this.STATUSES.REJECTED]: [],
    [this.STATUSES.CANCELED_BY_CUSTOMER]: [],
    [this.STATUSES.CANCELED_BY_STORE]: [],
    [this.STATUSES.CANCELED_BY_DRIVER]: []
  };

  /**
   * Place a new order
   * @param {Object} orderData - Order data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created order
   */
  async placeOrder(orderData, userId) {
    try {
      const { items, phone, address_details, deliveryLat, deliveryLng, isTakeout, deliveryFee } = orderData;

      // Validate user exists
      const user = await userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate store exists
      const store = await userModel.findById(orderData.storeId);
      if (!store || store.role !== 'store') {
        throw new Error('Store not found');
      }

      // Validate items and calculate total
      let totalAmount = 0;
      const validatedItems = [];

      for (const item of items) {
        const product = await productModel.findById(item.productId);
        if (!product || product.store.toString() !== store._id.toString()) {
          throw new Error(`Product ${item.productId} not found in store catalog`);
        }

        if (!product.available) {
          throw new Error(`Product ${product.name} is not available`);
        }

        if (product.stock > 0 && item.quantity > product.stock) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
        }

        validatedItems.push({
          product: product._id,
          store: store._id,
          catalog: item.catalogId,
          image: product.image,
          quantity: item.quantity,
          addedAt: new Date()
        });

        totalAmount += product.price * item.quantity;
      }

      // Create order
      const order = new orderModel({
        orderName: `Order-${Date.now()}`,
        user: userId,
        store: store._id,
        items: validatedItems,
        status: this.STATUSES.PLACED,
        phone,
        address_details,
        deliveryLat,
        deliveryLng,
        isTakeout,
        deliveryFee,
        amount: totalAmount + deliveryFee,
        payment: false, // Default to unpaid
        isActive: true,
        datePlaced: new Date()
      });

      await order.save();

      // Populate and return order
      return await orderModel.findById(order._id)
        .populate('user', 'name username phone email')
        .populate('store', 'name username phone email')
        .populate('items.product', 'name price image')
        .populate('driver', 'name username phone');
    } catch (error) {
      throw new Error(`Failed to place order: ${error.message}`);
    }
  }

  /**
   * Update order status
   * @param {string} orderId - Order ID
   * @param {string} newStatus - New status
   * @param {string} userId - User ID (for authorization)
   * @param {string} userType - Type of user (customer, store, driver)
   * @returns {Promise<Object>} Updated order
   */
  async updateOrderStatus(orderId, newStatus, userId, userType) {
    try {
      const order = await orderModel.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Validate status transition
      if (!this.isValidStatusTransition(order.status, newStatus)) {
        throw new Error(`Invalid status transition from ${order.status} to ${newStatus}`);
      }

      // Validate authorization
      if (!this.isAuthorizedToUpdateStatus(order, userId, userType, newStatus)) {
        throw new Error('Unauthorized to update order status');
      }

      // Update status and timestamps
      order.status = newStatus;
      order.updatedAt = new Date();

      // Set specific timestamps based on status
      switch (newStatus) {
        case this.STATUSES.ACCEPTED:
          order.dateAccepted_byStore = new Date();
          break;
        case this.STATUSES.PREPARED:
          order.datePrepared_byStore = new Date();
          break;
        case this.STATUSES.PICKED_UP:
          order.datePickedup_byDriver = new Date();
          break;
        case this.STATUSES.DELIVERED:
          order.dateDelivered_byDriver = new Date();
          break;
        case this.STATUSES.RECEIVED:
          order.dateReceived_byCustomer = new Date();
          break;
        case this.STATUSES.REJECTED:
          order.dateRejected_byStore = new Date();
          break;
        case this.STATUSES.CANCELED_BY_CUSTOMER:
        case this.STATUSES.CANCELED_BY_STORE:
        case this.STATUSES.CANCELED_BY_DRIVER:
          order.dateCanceled = new Date();
          order.isActive = false;
          break;
      }

      await order.save();

      // Populate and return order
      return await orderModel.findById(order._id)
        .populate('user', 'name username phone email')
        .populate('store', 'name username phone email')
        .populate('items.product', 'name price image')
        .populate('driver', 'name username phone');
    } catch (error) {
      throw new Error(`Failed to update order status: ${error.message}`);
    }
  }

  /**
   * Get order progress
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Order progress information
   */
  async getOrderProgress(orderId) {
    try {
      const order = await orderModel.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const progress = this.calculateOrderProgress(order);
      return {
        orderId: order._id,
        status: order.status,
        progress,
        estimatedTimes: {
          preparation: order.datePrepared_byStore_est,
          pickup: order.datePickedup_byDriver_est,
          delivery: order.dateDelivered_byDriver_est
        },
        actualTimes: {
          placed: order.datePlaced,
          accepted: order.dateAccepted_byStore,
          prepared: order.datePrepared_byStore,
          pickedUp: order.datePickedup_byDriver,
          delivered: order.dateDelivered_byDriver,
          received: order.dateReceived_byCustomer
        }
      };
    } catch (error) {
      throw new Error(`Failed to get order progress: ${error.message}`);
    }
  }

  /**
   * Get orders for a user
   * @param {string} userId - User ID
   * @param {string} userType - Type of user (customer, store, driver)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Orders array
   */
  async getUserOrders(userId, userType, filters = {}) {
    try {
      let query = { isActive: true };

      switch (userType) {
        case 'customer':
          query.user = userId;
          break;
        case 'store':
          query.store = userId;
          break;
        case 'driver':
          query.driver = userId;
          break;
        default:
          throw new Error('Invalid user type');
      }

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.dateFrom) {
        query.datePlaced = { $gte: new Date(filters.dateFrom) };
      }

      if (filters.dateTo) {
        query.datePlaced = { ...query.datePlaced, $lte: new Date(filters.dateTo) };
      }

      const orders = await orderModel.find(query)
        .populate('user', 'name username phone email')
        .populate('store', 'name username phone email')
        .populate('items.product', 'name price image')
        .populate('driver', 'name username phone')
        .sort({ datePlaced: -1 })
        .lean();

      return orders.map(order => ({
        ...order,
        progress: this.calculateOrderProgress(order)
      }));
    } catch (error) {
      throw new Error(`Failed to get user orders: ${error.message}`);
    }
  }

  /**
   * Get available orders for driver
   * @param {string} driverId - Driver ID
   * @returns {Promise<Array>} Available orders
   */
  async getAvailableOrders(driverId) {
    try {
      const orders = await orderModel.find({
        status: this.STATUSES.PREPARED,
        driver: null,
        isActive: true
      })
        .populate('user', 'name username phone email')
        .populate('store', 'name username phone email')
        .populate('items.product', 'name price image')
        .sort({ datePlaced: 1 })
        .lean();

      return orders.map(order => ({
        ...order,
        progress: this.calculateOrderProgress(order)
      }));
    } catch (error) {
      throw new Error(`Failed to get available orders: ${error.message}`);
    }
  }

  /**
   * Assign driver to order
   * @param {string} orderId - Order ID
   * @param {string} driverId - Driver ID
   * @returns {Promise<Object>} Updated order
   */
  async assignDriver(orderId, driverId) {
    try {
      const order = await orderModel.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== this.STATUSES.PREPARED) {
        throw new Error('Order is not ready for pickup');
      }

      if (order.driver) {
        throw new Error('Order already has a driver assigned');
      }

      // Validate driver exists
      const driver = await userModel.findById(driverId);
      if (!driver || driver.role !== 'driver') {
        throw new Error('Invalid driver');
      }

      order.driver = driverId;
      order.updatedAt = new Date();
      await order.save();

      return await orderModel.findById(order._id)
        .populate('user', 'name username phone email')
        .populate('store', 'name username phone email')
        .populate('items.product', 'name price image')
        .populate('driver', 'name username phone');
    } catch (error) {
      throw new Error(`Failed to assign driver: ${error.message}`);
    }
  }

  /**
   * Add customer feedback to order
   * @param {string} orderId - Order ID
   * @param {Object} feedback - Feedback data
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Updated order
   */
  async addFeedback(orderId, feedback, customerId) {
    try {
      const order = await orderModel.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.user.toString() !== customerId) {
        throw new Error('Unauthorized to add feedback for this order');
      }

      if (order.status !== this.STATUSES.RECEIVED) {
        throw new Error('Cannot add feedback until order is received');
      }

      order.customerRating = feedback.rating;
      order.customerComment = feedback.comment;
      order.customerReactions = feedback.reactions || [];
      order.updatedAt = new Date();

      await order.save();
      return order;
    } catch (error) {
      throw new Error(`Failed to add feedback: ${error.message}`);
    }
  }

  /**
   * Calculate order progress percentage
   * @param {Object} order - Order object
   * @returns {Object} Progress information
   */
  calculateOrderProgress(order) {
    const stages = [
      { status: this.STATUSES.PLACED, weight: 10 },
      { status: this.STATUSES.ACCEPTED, weight: 20 },
      { status: this.STATUSES.PREPARED, weight: 40 },
      { status: this.STATUSES.PICKED_UP, weight: 70 },
      { status: this.STATUSES.DELIVERED, weight: 90 },
      { status: this.STATUSES.RECEIVED, weight: 100 }
    ];

    const currentStage = stages.find(s => s.status === order.status);
    const progress = currentStage ? currentStage.weight : 0;

    return {
      percentage: progress,
      currentStatus: order.status,
      isCompleted: order.status === this.STATUSES.RECEIVED,
      isCanceled: [
        this.STATUSES.REJECTED,
        this.STATUSES.CANCELED_BY_CUSTOMER,
        this.STATUSES.CANCELED_BY_STORE,
        this.STATUSES.CANCELED_BY_DRIVER
      ].includes(order.status)
    };
  }

  /**
   * Validate status transition
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - New status
   * @returns {boolean} Whether transition is valid
   */
  isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = this.STATUS_TRANSITIONS[currentStatus] || [];
    return validTransitions.includes(newStatus);
  }

  /**
   * Check if user is authorized to update order status
   * @param {Object} order - Order object
   * @param {string} userId - User ID
   * @param {string} userType - Type of user
   * @param {string} newStatus - New status
   * @returns {boolean} Whether user is authorized
   */
  isAuthorizedToUpdateStatus(order, userId, userType, newStatus) {
    switch (userType) {
      case 'customer':
        return order.user.toString() === userId && 
               [this.STATUSES.CANCELED_BY_CUSTOMER, this.STATUSES.RECEIVED].includes(newStatus);
      
      case 'store':
        return order.store.toString() === userId && 
               [this.STATUSES.ACCEPTED, this.STATUSES.PREPARED, this.STATUSES.REJECTED, this.STATUSES.CANCELED_BY_STORE].includes(newStatus);
      
      case 'driver':
        return order.driver && order.driver.toString() === userId && 
               [this.STATUSES.PICKED_UP, this.STATUSES.DELIVERED, this.STATUSES.CANCELED_BY_DRIVER].includes(newStatus);
      
      default:
        return false;
    }
  }

  /**
   * Get dashboard statistics
   * @param {string} userId - User ID
   * @param {string} userType - Type of user
   * @returns {Promise<Object>} Dashboard statistics
   */
  async getDashboardStatistics(userId, userType) {
    try {
      let query = {};
      
      switch (userType) {
        case 'customer':
          query.user = userId;
          break;
        case 'store':
          query.store = userId;
          break;
        case 'driver':
          query.driver = userId;
          break;
        case 'admin':
          // No additional query for admin
          break;
        default:
          throw new Error('Invalid user type');
      }

      const [
        totalOrders,
        placedOrders,
        acceptedOrders,
        pendingOrders,
        completedOrders,
        revenue
      ] = await Promise.all([
        orderModel.countDocuments({ ...query, isActive: true }),
        orderModel.countDocuments({ ...query, status: this.STATUSES.PLACED, isActive: true }),
        orderModel.countDocuments({ ...query, status: this.STATUSES.ACCEPTED, isActive: true }),
        orderModel.countDocuments({ 
          ...query, 
          status: { $in: [this.STATUSES.PLACED, this.STATUSES.ACCEPTED, this.STATUSES.PREPARED] },
          isActive: true 
        }),
        orderModel.countDocuments({ 
          ...query, 
          status: { $in: [this.STATUSES.RECEIVED, this.STATUSES.DELIVERED] },
          isActive: true 
        }),
        orderModel.aggregate([
          { $match: { ...query, isActive: true, payment: true } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
      ]);

      const stats = {
        totalOrders,
        placedOrders,
        acceptedOrders,
        pendingOrders,
        completedOrders,
        revenue: revenue[0]?.total || 0
      };

      // Add user-specific stats
      if (userType === 'store') {
        stats.availableOrders = await orderModel.countDocuments({
          status: this.STATUSES.PREPARED,
          driver: null,
          isActive: true
        });
      }

      return stats;
    } catch (error) {
      throw new Error(`Failed to get dashboard statistics: ${error.message}`);
    }
  }
}

// Export singleton instance
export default new OrderService();