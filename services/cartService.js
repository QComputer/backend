/**
 * Cart Service
 * Centralized cart business logic and operations
 */

import cartModel from '../models/cartModel.js';
import productModel from '../models/productModel.js';
import catalogModel from '../models/catalogModel.js';
import { successResponse, errorResponse, notFoundResponse } from '../utils/apiResponse.js';

/**
 * Cart Service Class
 * Handles all cart-related business logic
 */
class CartService {
  /**
   * Get cart for a recorded user or guest
   * @param {any} userContext - User ID or guest session ID
   * @returns {Promise<Object>} Cart object with populated data
   */
  async getCart(userContext) {
    try {
      let query;
      if (typeof userContext === 'string') {
        // Legacy support for string userId/sessionId
        const isGuestSession = userContext.startsWith('guest_');
        query = isGuestSession ? { sessionId: userContext } : { user: userContext };
      } else if (userContext && userContext.userId) {
        // New unified context object
        // Handle anonymous users by using session-based carts
        if (userContext.userId === 'anonymous') {
          // For anonymous users, generate a session-based cart
          const sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          query = { sessionId: sessionId };
        } else {
          query = { user: userContext.userId };
        }
      } else if (userContext && userContext.sessionId) {
        // Guest session context
        query = { sessionId: userContext.sessionId };
      } else {
        throw new Error('Invalid user context provided');
      }

      let cart = await cartModel.findOne(query)
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
          select: 'name _id'
        });

      if (!cart) {
        // Create new cart if doesn't exist
        const cartData = {
          items: [],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };

        if (query.sessionId) {
          cartData.sessionId = sessionId;
        } else {
          cartData.user = query.user;
        }

        cart = new cartModel(cartData);
        await cart.save();
      }

      return cart;
    } catch (error) {
      throw new Error(`Failed to get cart: ${error.message}`);
    }
  }

  /**
   * Add item to cart
   * @param {any} userContext - User ID or session ID
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to add
   * @param {string} catalogId - Catalog ID
   * @returns {Promise<Object>} Updated cart
   */
  async addToCart(userContext, productId, quantity, catalogId) {
    try {
      // Validate product exists and is available
      const product = await productModel.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.available) {
        throw new Error('Product is not available');
      }

      // Get or create cart using unified context
      let cart = await this.getCart(userContext);

      // Check if item already exists in cart for this store/catalog
      const existingItemIndex = cart.items.findIndex(item =>
        item.product._id.toString() === productId &&
        item.catalog._id.toString() === catalogId
      );

      if (existingItemIndex > -1) {
        // Update existing item quantity
        const currentItem = cart.items[existingItemIndex];
        const newQuantity = currentItem.quantity + quantity;

        if (product.stock > 0 && newQuantity > product.stock) {
          throw new Error(`Cannot add more than ${product.stock} items. You already have ${currentItem.quantity} in cart.`);
        }

        cart.items[existingItemIndex].quantity = newQuantity;
      } else {
        // Add new item
        cart.items.push({
          product: productId,
          store: product.store,
          catalog: catalogId,
          quantity: quantity,
          addedAt: new Date()
        });
      }

      // Update cart timestamp
      cart.updatedAt = new Date();
      await cart.save();

      // Populate the updated cart
      cart = await cartModel.findById(cart._id)
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
          select: 'name'
        });

      return cart;
    } catch (error) {
      throw new Error(`Failed to add to cart: ${error.message}`);
    }
  }

  /**
   * Update item quantity in cart
   * @param {any} userContext - User ID or session ID
   * @param {string} productId - Product ID
   * @param {number} quantity - New quantity
   * @param {string} catalogId - Catalog ID
   * @returns {Promise<Object>} Updated cart
   */
  async updateCart(userContext, productId, quantity, catalogId) {
    try {
      if (quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      // Get cart using unified context
      let cart = await this.getCart(userContext);

      // Find item index
      const itemIndex = cart.items.findIndex(item =>
        item.product._id.toString() === productId &&
        item.catalog._id.toString() === catalogId
      );

      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }

      // Validate product availability and stock
      const product = await productModel.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.available) {
        throw new Error('Product is not available');
      }

      if (product.stock > 0 && quantity > product.stock) {
        throw new Error(`Only ${product.stock} items available in stock`);
      }

      // Update quantity
      cart.items[itemIndex].quantity = quantity;
      cart.updatedAt = new Date();
      await cart.save();

      // Populate the updated cart
      cart = await cartModel.findById(cart._id)
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
        });

      return cart;
    } catch (error) {
      throw new Error(`Failed to update cart: ${error.message}`);
    }
  }

  /**
   * Remove item from cart
   * @param {any} userContext - User ID or session ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Updated cart
   */
  async removeFromCart(userContext, productId) {
    try {
      // Get cart using unified context
      let cart = await this.getCart(userContext);

      // Find item index
      const itemIndex = cart.items.findIndex(item =>
        item.product._id.toString() === productId
      );

      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }

      // Remove item
      cart.items.splice(itemIndex, 1);
      cart.updatedAt = new Date();
      await cart.save();

      // Populate the updated cart
      cart = await cartModel.findById(cart._id)
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
        });

      return cart;
    } catch (error) {
      throw new Error(`Failed to remove from cart: ${error.message}`);
    }
  }

  /**
   * Clear all items from cart
   * @param {any} userContext - User ID or session ID
   * @returns {Promise<Object>} Updated cart
   */
  async clearCart(userContext) {
    try {
      // Get cart using unified context
      let cart = await this.getCart(userContext);
      
      cart.items = [];
      cart.updatedAt = new Date();
      await cart.save();

      return cart;
    } catch (error) {
      throw new Error(`Failed to clear cart: ${error.message}`);
    }
  }

  /**
   * Get cart item count
   * @param {any} userContext - User ID or session ID
   * @returns {Promise<number>} Total item count
   */
  async getCartCount(userContext) {
    try {
      // Get cart using unified context
      const cart = await this.getCart(userContext);
      return cart.items.reduce((total, item) => total + item.quantity, 0);
    } catch (error) {
      throw new Error(`Failed to get cart count: ${error.message}`);
    }
  }

  /**
   * Get cart total value
   * @param {any} userContext - User ID or session ID
   * @returns {Promise<number>} Total value
   */
  async getCartTotal(userContext) {
    try {
      // Get cart using unified context
      const cart = await this.getCart(userContext);
      return cart.items.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
      }, 0);
    } catch (error) {
      throw new Error(`Failed to calculate cart total: ${error.message}`);
    }
  }

  /**
   * Validate cart items (check availability and stock)
   * @param {any} userContext - User ID or guest session ID
   * @returns {Promise<Object>} Validation result
   */
  async validateCart(userContext) {
    try {
      // Get cart using unified context
      const cart = await this.getCart(userContext);
      const issues = [];

      for (const item of cart.items) {
        const product = await productModel.findById(item.product._id);
        
        if (!product) {
          issues.push({
            productId: item.product._id,
            issue: 'Product not found',
            action: 'remove'
          });
        } else if (!product.available) {
          issues.push({
            productId: item.product._id,
            issue: 'Product is no longer available',
            action: 'remove'
          });
        } else if (product.stock > 0 && item.quantity > product.stock) {
          issues.push({
            productId: item.product._id,
            issue: `Only ${product.stock} items available in stock`,
            action: 'update',
            maxQuantity: product.stock
          });
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        cart
      };
    } catch (error) {
      throw new Error(`Failed to validate cart: ${error.message}`);
    }
  }

  /**
   * Migrate guest cart to user cart
   * @param {string} sessionId - Guest session ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Migrated cart
   */
  async migrateGuestCart(guestSessionId, userId) {
    try {
      // Get guest cart using unified context
      const guestCart = await this.getCart({ sessionId });
      
      if (!guestCart || guestCart.items.length === 0) {
        return await this.getCart({ userId }); // Return user's cart
      }

      // Get user cart using unified context
      let userCart = await this.getCart({ userId });

      // Merge items from guest cart to user cart
      for (const guestItem of guestCart.items) {
        const existingIndex = userCart.items.findIndex(item =>
          item.product._id.toString() === guestItem.product._id.toString() &&
          item.catalog._id.toString() === guestItem.catalog._id.toString()
        );

        if (existingIndex > -1) {
          // Update existing item quantity
          const newQuantity = userCart.items[existingIndex].quantity + guestItem.quantity;
          userCart.items[existingIndex].quantity = newQuantity;
        } else {
          // Add new item
          userCart.items.push(guestItem);
        }
      }

      // Update timestamps
      userCart.updatedAt = new Date();
      await userCart.save();

      // Clear guest cart
      await this.clearCart({ sessionId: guestSessionId });

      // Populate and return user cart
      userCart = await cartModel.findById(userCart._id)
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
        });

      return userCart;
    } catch (error) {
      throw new Error(`Failed to migrate guest cart: ${error.message}`);
    }
  }
}

// Export singleton instance
export default new CartService();