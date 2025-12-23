/**
 * Database Query Optimization Utilities
 * Provides optimized query patterns for common operations
 */

/**
 * Optimized product queries with proper population and lean usage
 */
export const productQueries = {
  /**
   * Get products with optimized population for list views
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options (sort, limit, skip)
   * @returns {Promise<Array>} Products array
   */
  getList: async (filters = {}, options = {}) => {
    const { sort = { createdAt: -1 }, limit = 20, skip = 0 } = options;
    
    return await productModel.find(filters)
      .select('name price image available stock category store createdAt updatedAt')
      .populate({
        path: 'category',
        select: 'name image'
      })
      .populate({
        path: 'store',
        select: 'name username'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  },

  /**
   * Get products for cart operations (minimal data)
   * @param {Array} productIds - Array of product IDs
   * @returns {Promise<Array>} Products array
   */
  getCartProducts: async (productIds) => {
    return await productModel.find({
      _id: { $in: productIds },
      available: true
    })
      .select('name price image stock available')
      .lean();
  },

  /**
   * Get products with categories in single query
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Products and categories
   */
  getWithCategories: async (filters = {}) => {
    const products = await productModel.find(filters)
      .select('name price image available stock category store createdAt updatedAt')
      .populate({
        path: 'category',
        select: 'name image'
      })
      .populate({
        path: 'store',
        select: 'name username'
      })
      .lean();

    // Extract unique category IDs
    const categoryIds = [...new Set(products.map(p => p.category?._id).filter(Boolean))];
    
    const categories = await categoryModel.find({
      _id: { $in: categoryIds }
    })
      .select('name image description')
      .lean();

    return { products, categories };
  },

  /**
   * Search products with text index
   * @param {string} searchQuery - Search query
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Search results
   */
  search: async (searchQuery, filters = {}) => {
    const query = {
      $and: [
        { $text: { $search: searchQuery } },
        filters
      ]
    };

    return await productModel.find(query)
      .select('name price image available stock category store score')
      .populate({
        path: 'category',
        select: 'name'
      })
      .populate({
        path: 'store',
        select: 'name username'
      })
      .sort({ score: { $meta: 'textScore' } })
      .lean();
  }
};

/**
 * Optimized order queries with proper population
 */
export const orderQueries = {
  /**
   * Get user orders with optimized population
   * @param {string} userId - User ID
   * @param {string} userType - Type of user (customer, store, driver)
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Orders array
   */
  getUserOrders: async (userId, userType, filters = {}, options = {}) => {
    const { sort = { datePlaced: -1 }, limit = 20, skip = 0 } = options;
    
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

    // Apply additional filters
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.dateFrom) {
      query.datePlaced = { $gte: new Date(filters.dateFrom) };
    }

    if (filters.dateTo) {
      query.datePlaced = { ...query.datePlaced, $lte: new Date(filters.dateTo) };
    }

    return await orderModel.find(query)
      .select('orderName status amount datePlaced dateAccepted_byStore datePrepared_byStore datePickedup_byDriver dateDelivered_byDriver dateReceived_byCustomer items user store driver')
      .populate({
        path: 'user',
        select: 'name username phone email'
      })
      .populate({
        path: 'store',
        select: 'name username phone email'
      })
      .populate({
        path: 'driver',
        select: 'name username phone'
      })
      .populate({
        path: 'items.product',
        select: 'name price image'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  },

  /**
   * Get available orders for driver
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Available orders
   */
  getAvailableOrders: async (options = {}) => {
    const { sort = { datePlaced: 1 }, limit = 20, skip = 0 } = options;
    
    return await orderModel.find({
      status: 'prepared',
      driver: null,
      isActive: true
    })
      .select('orderName status amount datePlaced items user store')
      .populate({
        path: 'user',
        select: 'name username phone email'
      })
      .populate({
        path: 'store',
        select: 'name username phone email'
      })
      .populate({
        path: 'items.product',
        select: 'name price image'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  },

  /**
   * Get order statistics for dashboard
   * @param {string} userId - User ID
   * @param {string} userType - Type of user
   * @returns {Promise<Object>} Statistics
   */
  getDashboardStats: async (userId, userType) => {
    let matchQuery = {};
    
    switch (userType) {
      case 'customer':
        matchQuery.user = userId;
        break;
      case 'store':
        matchQuery.store = userId;
        break;
      case 'driver':
        matchQuery.driver = userId;
        break;
      case 'admin':
        // No additional match for admin
        break;
      default:
        throw new Error('Invalid user type');
    }

    const stats = await orderModel.aggregate([
      { $match: { ...matchQuery, isActive: true } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          placedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'placed'] }, 1, 0] }
          },
          acceptedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
          },
          pendingOrders: {
            $sum: {
              $cond: [{
                $in: ['$status', ['placed', 'accepted', 'prepared']]
              }, 1, 0]
            }
          },
          completedOrders: {
            $sum: {
              $cond: [{
                $in: ['$status', ['received', 'delivered']]
              }, 1, 0]
            }
          },
          revenue: {
            $sum: { $cond: ['$payment', '$amount', 0] }
          }
        }
      }
    ]);

    return stats[0] || {
      totalOrders: 0,
      placedOrders: 0,
      acceptedOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      revenue: 0
    };
  }
};

/**
 * Optimized cart queries
 */
export const cartQueries = {
  /**
   * Get cart with optimized population
   * @param {string} userId - User ID or guest session ID
   * @returns {Promise<Object>} Cart object
   */
  getCart: async (userId) => {
    return await cartModel.findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'name price image available stock'
      })
      .populate({
        path: 'items.store',
        select: 'name username'
      })
      .populate({
        path: 'items.catalog',
        select: 'name design'
      })
      .lean();
  },

  /**
   * Get cart item count
   * @param {string} userId - User ID or guest session ID
   * @returns {Promise<number>} Item count
   */
  getItemCount: async (userId) => {
    const cart = await cartModel.findOne({ user: userId })
      .select('items')
      .lean();
    
    return cart ? cart.items.reduce((total, item) => total + item.quantity, 0) : 0;
  },

  /**
   * Get cart total value
   * @param {string} userId - User ID or guest session ID
   * @returns {Promise<number>} Total value
   */
  getTotal: async (userId) => {
    const cart = await cartModel.findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'price'
      })
      .lean();
    
    if (!cart) return 0;
    
    return cart.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);
  }
};

/**
 * Optimized user queries
 */
export const userQueries = {
  /**
   * Get users with role filtering
   * @param {string} role - User role to filter
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Users array
   */
  getByRole: async (role, options = {}) => {
    const { sort = { createdAt: -1 }, limit = 20, skip = 0 } = options;
    
    return await userModel.find({ role, isActive: true })
      .select('name username phone email statusMain statusCustom avatar image createdAt updatedAt')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  },

  /**
   * Get user profile with minimal data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile
   */
  getProfile: async (userId) => {
    return await userModel.findById(userId)
      .select('name username phone email moreInfo statusMain statusCustom avatar image locationLat locationLng shareLocation createdAt updatedAt')
      .lean();
  },

  /**
   * Search users by name or username
   * @param {string} searchQuery - Search query
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Search results
   */
  search: async (searchQuery, filters = {}) => {
    const query = {
      $and: [
        {
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { username: { $regex: searchQuery, $options: 'i' } }
          ]
        },
        filters
      ]
    };

    return await userModel.find(query)
      .select('name username phone email statusMain statusCustom avatar image')
      .lean();
  }
};

/**
 * Query performance monitoring
 */
export const queryMonitor = {
  /**
   * Measure query execution time
   * @param {Function} queryFn - Query function to measure
   * @param {string} queryName - Name of the query for logging
   * @returns {Promise} Query result
   */
  measure: async (queryFn, queryName) => {
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      if (duration > 1000) { // Log slow queries
        console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Query failed: ${queryName} took ${duration}ms`, error);
      throw error;
    }
  },

  /**
   * Add query timeout
   * @param {Promise} queryPromise - Query promise
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Query result with timeout
   */
  withTimeout: (queryPromise, timeout = 30000) => {
    return Promise.race([
      queryPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeout)
      )
    ]);
  }
};

/**
 * Common query patterns and utilities
 */
export const queryUtils = {
  /**
   * Paginate results
   * @param {Array} data - Data array
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Object} Paginated result
   */
  paginate: (data, page = 1, limit = 20) => {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const results = data.slice(startIndex, endIndex);

    return {
      data: results,
      pagination: {
        page,
        limit,
        total: data.length,
        pages: Math.ceil(data.length / limit),
        hasNext: endIndex < data.length,
        hasPrev: startIndex > 0
      }
    };
  },

  /**
   * Build dynamic query filters
   * @param {Object} baseFilters - Base filters
   * @param {Object} dynamicFilters - Dynamic filters from request
   * @returns {Object} Combined filters
   */
  buildFilters: (baseFilters = {}, dynamicFilters = {}) => {
    const filters = { ...baseFilters };

    // Handle date range filters
    if (dynamicFilters.dateFrom || dynamicFilters.dateTo) {
      filters.createdAt = {};
      if (dynamicFilters.dateFrom) {
        filters.createdAt.$gte = new Date(dynamicFilters.dateFrom);
      }
      if (dynamicFilters.dateTo) {
        filters.createdAt.$lte = new Date(dynamicFilters.dateTo);
      }
    }

    // Handle status filters
    if (dynamicFilters.status) {
      filters.status = dynamicFilters.status;
    }

    // Handle role filters
    if (dynamicFilters.role) {
      filters.role = dynamicFilters.role;
    }

    // Handle availability filters
    if (dynamicFilters.available !== undefined) {
      filters.available = dynamicFilters.available;
    }

    return filters;
  },

  /**
   * Build dynamic sort options
   * @param {Object} sortOptions - Sort options from request
   * @returns {Object} Sort object
   */
  buildSort: (sortOptions = {}) => {
    const sort = {};
    
    if (sortOptions.field) {
      sort[sortOptions.field] = sortOptions.direction === 'desc' ? -1 : 1;
    }
    
    return Object.keys(sort).length > 0 ? sort : { createdAt: -1 };
  }
};