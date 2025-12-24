import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import cartModel from "../models/cartModel.js";
import catalogModel from "../models/catalogModel.js";
import mongoose from "mongoose";
import winston from "winston";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Customer controllers
const placeOrder_Old = async (req, res) => {
  try {
    logger.info(`Place order request: ${JSON.stringify(req.body)}`);
    // Get user from authentication or request body
    const userId = req.userId;// || req.body.userId;
    
    if (!userId) {
      return res.json({ success: false, message: "User ID is required" });
    }
    
    const phone = req.body.phone?.length > 0 ? req.body.phone : user.phone;
    
    // Support both storeId (ObjectId) and storeUserName (username)
    let store;
    if (req.body.storeId) {
      store = await userModel.findById(req.body.storeId);
    } else if (req.body.storeUserName) {
      store = await userModel.findOne({
        username: req.body.storeUserName,
        role: "store",
      });
    } else if (user.role === 'store') {
      // If user is a store, use their own store
      store = user;
    }
    
    if (!store) {
      const storeIdentifier = req.body.storeId || req.body.storeUserName;
      const message = "ERROR: found no store with identifier: " + storeIdentifier;
      logger.error(`Store not found: ${storeIdentifier} for user: ${userId}`);
      return res.json({ success: false, message: message });
    }
    
    // Verify the store has the correct role
    if (store.role !== "store") {
      logger.error(`User ${store._id} is not a store`);
      return res.json({ success: false, message: "Invalid store identifier" });
    }

    // Validate cart items and check against actual cart contents
    logger.info(`Validating items for order placement by user: ${userId}`);

    // Get user's current cart to validate items
    const userCart = await cartModel.findOne({ user: userId });
    if (!userCart) {
      logger.error(`No cart found for user: ${userId}`);
      return res.json({ success: false, message: "Your cart is empty" });
    }

    // Validate each item against cart contents
    for (const item of req.body.items) {
      const productId = item._id || item.productId; // Support both _id and productId
      const product = await productModel.findById(productId);

      if (!product) {
        logger.error(`Product not found: ${productId} for user: ${userId}`);
        return res.json({ success: false, message: `Product not found: ${productId}` });
      }
      if (!product.available) {
        logger.error(`Product not available: ${productId} (${product.name}) for user: ${userId}`);
        return res.json({ success: false, message: `Product not available: ${product.name}` });
      }
      if (product.stock < item.quantity) {
        logger.error(`Insufficient stock for product: ${productId} (${product.name}), requested: ${item.quantity}, available: ${product.stock} for user: ${userId}`);
        return res.json({ success: false, message: `Insufficient stock for ${product.name}. Available: ${product.stock}, requested: ${item.quantity}` });
      }

      // Check if item exists in cart with correct quantity
      const cartItem = userCart.items.find(cartItem =>
        cartItem.product.equals(productId) &&
        cartItem.quantity === item.quantity
      );

      if (!cartItem) {
        logger.error(`Item mismatch: Product ${productId} (${product.name}) with quantity ${item.quantity} not found in cart for user: ${userId}`);
        return res.json({ success: false, message: `Item mismatch: ${product.name} with quantity ${item.quantity} not found in your cart` });
      }
    }
    logger.info(`All items validated successfully for user: ${userId}`);

    // Decrement stock for each item
    for (const item of req.body.items) {
      const productId = item._id || item.productId; // Support both _id and productId
      await productModel.findByIdAndUpdate(productId, { $inc: { stock: -item.quantity } });
    }
    logger.info(`Stock decremented for ${req.body.items.length} items`);

    const newOrder = new orderModel({
      user: userId,
      orderName: req.body.orderName,
      store: store._id,
      catalog: req.body.catalog || null,
      driver: null,
      phone: phone,
      address_details: req.body.address_details || null,
      deliveryLat: req.body.deliveryLat || null,
      deliveryLng: req.body.deliveryLng || null,
      isTakeout: req.body.isTakeout,
      deliveryFee: req.body.deliveryFee,
      amount: req.body.amount,
      items: req.body.items,
      isActive: true,
      status: "placed",
      datePlaced: Date.now(),
    });
    logger.info(`Saving order for user: ${userId}, items count: ${req.body.items.length}, total amount: ${req.body.amount}`);
    await newOrder.save();
    logger.info(`Order saved successfully with ID: ${newOrder._id}`);

    // Clear the user's cart using the new cart model
    await cartModel.deleteOne({ user: userId });
    logger.info(`Cart cleared for user: ${userId}`);

    logger.info(`Order placed by user: ${user._id} for store: ${store.username}`);
    logger.info(`Order details: ${JSON.stringify({
      orderId: newOrder._id,
      userId: user._id,
      storeId: store._id,
      itemCount: req.body.items.length,
      totalAmount: req.body.amount,
      items: req.body.items.map(item => ({
        productId: item._id || item.productId,
        quantity: item.quantity,
        price: item.price
      }))
    })}`);
    res.json({ success: true, message: "Order placed successfully", orderId: newOrder._id });
  } catch (error) {
    logger.error('Error placing order:', error);
    res.json({ success: false, message: error.message });
  }
};

// Unified order placement function - handles all cases (authenticated users and guests)
const placeOrder = async (req, res) => {
  try {
    logger.info(`Place order request: ${JSON.stringify(req.body)}`);
    
    const { storeId, items, phone, address_details, deliveryLat, deliveryLng, isTakeout, deliveryFee, amount, orderName } = req.body;
    const userId = req.userId;
    const sessionId = req.headers['x-session-id'];
    const isGuest = !userId && sessionId;
    const userIdentifier = isGuest ? `guest ${sessionId}` : `user ${userId}`;
    
    if (!storeId) {
      return res.json({ success: false, message: "Store ID is required" });
    }
     
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.json({ success: false, message: "Items are required" });
    }

    // Verify store exists
    const store = await userModel.findById(storeId);
    if (!store || store.role !== "store") {
      return res.json({ success: false, message: "Invalid store ID" });
    }

    // Get cart (either user cart or guest cart)
    let cart;
    if (isGuest) {
      cart = await cartModel.findOne({ sessionId: sessionId }).populate('items.catalog');
    } else {
      cart = await cartModel.findOne({ user: userId }).populate('items.catalog');
    }
    
    if (!cart) {
      return res.json({ success: false, message: "Your cart is empty" });
    }

    // Validate each item against cart contents and check they belong to the specified store
    for (const item of items) {
      const productId = item._id || item.productId;
      const product = await productModel.findById(productId);

      if (!product) {
        logger.error(`Product not found: ${productId} for ${userIdentifier}`);
        return res.json({ success: false, message: `Product not found: ${productId}` });
      }
      if (!product.available) {
        logger.error(`Product not available: ${productId} (${product.name}) for ${userIdentifier}`);
        return res.json({ success: false, message: `Product not available: ${product.name}` });
      }/*
      if (product.stock < item.quantity) {
        const userIdentifier = isGuest ? `guest ${sessionId}` : `user ${userId}`;
        logger.error(`Insufficient stock for product: ${productId} (${product.name}), requested: ${item.quantity}, available: ${product.stock} for ${userIdentifier}`);
        return res.json({ success: false, message: `Insufficient stock for ${product.name}. Available: ${product.stock}, requested: ${item.quantity}` });
      }*/

      // Check if item exists in cart with correct quantity and belongs to the specified store
      const cartItem = cart.items.find(cartItem =>
        cartItem.product.equals(productId) &&
        cartItem.quantity === item.quantity &&
        cartItem.store.equals(storeId)
      );

      if (!cartItem) {
        logger.error(`Item mismatch: Product ${productId} (${product.name}) with quantity ${item.quantity} not found in cart for store ${storeId}, ${userIdentifier}`);
        return res.json({ success: false, message: `Item mismatch: ${product.name} with quantity ${item.quantity} not found in your cart for this store` });
      }

      // Additional security: Verify product belongs to the store
      if (product.store.toString() !== storeId) {
        logger.error(`Security violation: Product ${productId} (${product.name}) does not belong to store ${storeId}, ${userIdentifier}`);
        return res.json({ success: false, message: `Product ${product.name} is not available from this store` });
      }
    }

    // Decrement stock for each item
    for (const item of items) {
      const productId = item._id || item.productId;
      await productModel.findByIdAndUpdate(productId, { $inc: { stock: -item.quantity } });
    }
    const user = await userModel.findById(userId);
    // Create order with catalog reference if provided
    const orderData = {
      user: userId || userIdentifier, // For guests, attribute to store
      orderName: orderName || `Order from ${userIdentifier}`,
      store: store._id,
      driver: null,
      phone: phone || (isGuest ? null : user.phone),
      address_details: address_details || user.address_details,
      deliveryLat: deliveryLat || null,
      deliveryLng: store.deliveryLng || null,
      isTakeout: store. isTakeout || false,
      deliveryFee: deliveryFee || 0,
      amount: amount,
      items: items,
      isActive: true,
      status: "placed",
      datePlaced: Date.now(),
    };

    // For guest orders, add session ID for tracking
    if (isGuest) {
      orderData.guestSessionId = sessionId;
    }

    const newOrder = new orderModel(orderData);
    await newOrder.save();
    
    logger.info(`Order placed: ${newOrder._id} for ${userIdentifier}, store ${storeId}`);

    // Clear only items from this store from the cart
    cart.items = cart.items.filter(item => item.store._id.toString() !== storeId);
    await cart.save();
    logger.info(`Cleared cart items for store ${storeId} from ${userIdentifier} cart`);

    const response = {
      success: true,
      message: "Order placed successfully",
      orderId: newOrder._id
    };
    
    // Add isGuest flag for guest orders
    if (isGuest) {
      response.isGuest = true;
    }
    
    res.json(response);
  } catch (error) {
    logger.error('Error placing order:', error);
    res.json({ success: false, message: error.message });
  }
};

// Place order from catalog cart (authenticated users)
const placeCatalogOrder = async (req, res) => {
  try {
    const { catalogId, items, deliveryAddress, phone, isTakeout, deliveryFee } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    if (!catalogId) {
      return res.status(400).json({ success: false, message: "Catalog ID is required" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items are required" });
    }

    // Verify catalog exists
    const catalog = await catalogModel.findById(catalogId);
    if (!catalog) {
      return res.status(404).json({ success: false, message: "Catalog not found" });
    }

    // Verify user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Validate items and calculate total
    let totalAmount = 0;

    // Get user's catalog cart to validate items
    const userCart = await cartModel.findOne({ user: userId, catalog: catalogId });
    if (!userCart) {
      logger.error(`No catalog cart found for user: ${userId}, catalog: ${catalogId}`);
      return res.status(400).json({ success: false, message: "Your catalog cart is empty" });
    }

    for (const item of items) {
      const product = await productModel.findById(item.productId || item._id);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.productId || item._id} not found` });
      }
      if (!product.available) {
        return res.status(400).json({ success: false, message: `Product ${product.name} is not available` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
      }

      // Check if item exists in cart with correct quantity
      const cartItem = userCart.items.find(cartItem =>
        cartItem.product.equals(product._id) &&
        cartItem.quantity === item.quantity
      );

      if (!cartItem) {
        logger.error(`Item mismatch: Product ${product._id} (${product.name}) with quantity ${item.quantity} not found in catalog cart for user: ${userId}`);
        return res.status(400).json({ success: false, message: `Item mismatch: ${product.name} with quantity ${item.quantity} not found in your cart` });
      }

      totalAmount += product.price * item.quantity;
    }

    // Decrement stock
    for (const item of items) {
      const productId = item.productId || item._id;
      await productModel.findByIdAndUpdate(productId, { $inc: { stock: -item.quantity } });
    }

    // Create order
    const orderData = {
      user: userId,
      store: catalog.ownerId, // Catalog owner is the store
      catalog: catalogId,
      orderName: catalog.name, // Order name is catalog name
      items: items,
      amount: totalAmount,
      deliveryFee: deliveryFee || 0,
      phone: phone || user.phone,
      address_details: deliveryAddress,
      isTakeout: isTakeout || false,
      isActive: true,
      status: "placed",
      datePlaced: new Date(),
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    // Clear the catalog cart for this user using the new cart model
    await cartModel.deleteOne({ user: userId, catalog: catalogId });

    logger.info(`Catalog order placed: ${newOrder._id} for user ${userId}, catalog ${catalogId}`);
    logger.info(`Catalog order details: ${JSON.stringify({
      orderId: newOrder._id,
      userId: userId,
      catalogId: catalogId,
      storeId: catalog.ownerId,
      itemCount: items.length,
      totalAmount: totalAmount,
      items: items.map(item => ({
        productId: item.productId || item._id,
        quantity: item.quantity,
        price: item.price || 'N/A'
      }))
    })}`);
    res.json({
      success: true,
      message: "Order placed successfully",
      orderId: newOrder._id,
      order: newOrder
    });
  } catch (error) {
    logger.error('Error placing catalog order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Place order from catalog cart (guest users)
const placeGuestCatalogOrder = async (req, res) => {
  try {
    const { catalogId, items, deliveryAddress, phone, isTakeout, deliveryFee } = req.body;
    const sessionId = req.headers['x-session-id'] || 'guest';

    if (!catalogId) {
      return res.status(400).json({ success: false, message: "Catalog ID is required", isGuest: true });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items are required", isGuest: true });
    }

    // Verify catalog exists
    const catalog = await catalogModel.findById(catalogId);
    if (!catalog) {
      return res.status(404).json({ success: false, message: "Catalog not found", isGuest: true });
    }

    // Validate items and calculate total
    let totalAmount = 0;

    // Get guest's catalog cart to validate items
    const guestCart = await cartModel.findOne({ sessionId: sessionId, catalog: catalogId });
    if (!guestCart) {
      logger.error(`No catalog cart found for guest session: ${sessionId}, catalog: ${catalogId}`);
      return res.status(400).json({ success: false, message: "Your catalog cart is empty", isGuest: true });
    }

    for (const item of items) {
      const product = await productModel.findById(item.productId || item._id);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.productId || item._id} not found`, isGuest: true });
      }
      if (!product.available) {
        return res.status(400).json({ success: false, message: `Product ${product.name} is not available`, isGuest: true });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}`, isGuest: true });
      }

      // Check if item exists in cart with correct quantity
      const cartItem = guestCart.items.find(cartItem =>
        cartItem.product.equals(product._id) &&
        cartItem.quantity === item.quantity
      );

      if (!cartItem) {
        logger.error(`Item mismatch: Product ${product._id} (${product.name}) with quantity ${item.quantity} not found in catalog cart for guest session: ${sessionId}`);
        return res.status(400).json({ success: false, message: `Item mismatch: ${product.name} with quantity ${item.quantity} not found in your cart`, isGuest: true });
      }

      totalAmount += product.price * item.quantity;
    }

    // Decrement stock
    for (const item of items) {
      const productId = item.productId || item._id;
      await productModel.findByIdAndUpdate(productId, { $inc: { stock: -item.quantity } });
    }

    // Create order - for guest orders, user is the catalog owner
    const orderData = {
      user: catalog.ownerId, // Guest orders are attributed to catalog owner
      store: catalog.ownerId, // Catalog owner is the store
      catalog: catalogId,
      guestSessionId: sessionId, // Store session ID for guest tracking
      orderName: catalog.name, // Order name is catalog name
      items: items,
      amount: totalAmount,
      deliveryFee: deliveryFee || 0,
      phone: phone,
      address_details: deliveryAddress,
      isTakeout: isTakeout || false,
      isActive: true,
      status: "placed",
      datePlaced: new Date(),
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    // Debug: Log the created order to verify guestSessionId
    logger.info(`Guest order created: ${JSON.stringify({
      orderId: newOrder._id,
      guestSessionId: newOrder.guestSessionId,
      sessionId: sessionId,
      catalogId: catalogId
    })}`);

    // Clear the entire guest cart for this session
    await cartModel.deleteOne({ sessionId: sessionId });

    logger.info(`Guest catalog order placed: ${newOrder._id} for session ${sessionId}, catalog ${catalogId}`);
    logger.info(`Guest catalog order details: ${JSON.stringify({
      orderId: newOrder._id,
      sessionId: sessionId,
      catalogId: catalogId,
      storeId: catalog.ownerId,
      itemCount: items.length,
      totalAmount: totalAmount,
      items: items.map(item => ({
        productId: item.productId || item._id,
        quantity: item.quantity,
        price: item.price || 'N/A'
      }))
    })}`);
    res.json({
      success: true,
      message: "Order placed successfully",
      orderId: newOrder._id,
      order: newOrder,
      isGuest: true
    });
  } catch (error) {
    logger.error('Error placing guest catalog order:', error);
    res.status(500).json({ success: false, message: error.message, isGuest: true });
  }
};

const receiveOrderByCustomer = async (req, res) => {
  try {
    const order = await orderModel.findById(req.body.orderId);
    if (order.status !== "pickedup" && order.status !== "prepared" && order.status !== "delivered") {
      return res.json({
        success: false,
        message: "the order is not 'pickedup' or 'prepared' or 'delivered'",
      });
    }

    await orderModel.findByIdAndUpdate(req.body.orderId, {
      stateReceived: "by-customer",
      dateReceived_byCustomer: Date.now(),
      done: true,
      status: "received",
    });

    logger.info(`Order received by customer: ${req.body.orderId}`);
    return res.json({
      success: true,
      message: `dateReceived_byCustomer: ${Date.now()}, status: received`,
    });
  } catch (error) {
    logger.error('Error receiving order by customer:', error);
    res.json({ success: false, message: error.message });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const order = await orderModel.findById(req.body.orderId);
    if (order.status !== "accepted" && order.status !== "prepared" && order.status !== "placed") {
      return res.json({
        success: false,
        message: "Cannot cancel order in current state",
      });
    }
    const userRole = req.userRole;
    if (userRole === 'customer') {
      await orderModel.findByIdAndUpdate(req.body.orderId, {
        dateCanceled_byCustomer: Date.now(),
        status: "canceled by customer",
        cancel: true,
        isActive: false,
      });
    } else if (userRole === 'store') {
      await orderModel.findByIdAndUpdate(req.body.orderId, {
        dateCanceled_byStore: Date.now(),
        status: "canceled by store",
        cancel: true,
        isActive: false,
      });
    } else if (userRole === 'driver') {
      await orderModel.findByIdAndUpdate(req.body.orderId, {
        dateCanceled_byDriver: Date.now(),
        status: "canceled by driver",
        cancel: true,
        isActive: false,
      });
    } else {
      return res.json({ success: false, message: "ERROR: Unauthorized to cancel this order" });
    }
    logger.info(`Order canceled: ${req.body.orderId}`);
    return res.json({ success: true, message: "Order canceled successfully" });
  } catch (error) {
    logger.error('Error canceling order:', error);
    res.json({
      success: false,
      message: "Error while order cancelation",
    });
  }
};

// Store controllers
const acceptOrderByStore = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const order = await orderModel.findById(req.body.orderId);

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permissions - only the store owner or admin can accept orders
    if (userRole !== 'admin' && order.store.toString() !== userId) {
      return res.json({
        success: false,
        message: "You don't have permission to accept this order.",
      });
    }

    if (order.status !== "placed") {
      return res.json({
        success: false,
        message: "the order is not 'placed' yet",
      });
    }

    await orderModel.findByIdAndUpdate(req.body.orderId, {
      status: "accepted",
      stateGiven: "by-store",
      dateAccepted_byStore: Date.now(),
      datePrepared_byStore_est: new Date(Date.now() + 600000), // 10 minutes
      isActive: true,
    });

    logger.info(`Order accepted by store: ${req.body.orderId} by user ${userId}`);
    return res.json({
      success: true,
      message: `dateAccepted_byStore: ${Date.now()}, status: accepted`,
      data: {}
    });
  } catch (error) {
    logger.error('Error accepting order by store:', error);
    res.json({ success: false, message: error.message });
  }
};

const rejectOrderByStore = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const order = await orderModel.findById(req.body.orderId);

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permissions - only the store owner or admin can reject orders
    if (userRole !== 'admin' && order.store.toString() !== userId) {
      return res.json({
        success: false,
        message: "You don't have permission to reject this order.",
      });
    }

    if (order.status !== "placed") {
      return res.json({
        success: false,
        message: "the order is not 'placed' yet",
      });
    }

    await orderModel.findByIdAndUpdate(req.body.orderId, {
      status: "rejected",
      stateRejected: "by-store",
      dateRejected_byStore: Date.now(),
      isActive: false,
    });

    logger.info(`Order rejected by store: ${req.body.orderId} by user ${userId}`);
    return res.json({
      success: true,
      message: `dateRejected_byStore: ${Date.now()}, status: rejected`,
      data: {}
    });
  } catch (error) {
    logger.error('Error rejecting order by store:', error);
    res.json({ success: false, message: error.message });
  }
};

const prepareOrder = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const order = await orderModel.findById(req.body.orderId);

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permissions - only the store owner or admin can prepare orders
    if (userRole !== 'admin' && order.store.toString() !== userId) {
      return res.json({
        success: false,
        message: "You don't have permission to prepare this order.",
      });
    }

    if (!order.isActive) {
      return res.json({
        success: false,
        message: "ERROR: the order is not activated yet.",
      });
    }
    if (order.status !== "accepted") {
      return res.json({
        success: false,
        message: "ERROR: the order is not accepted.",
      });
    }

    await orderModel.findByIdAndUpdate(req.body.orderId, {
      datePrepared_byStore: Date.now(),
      status: "prepared",
    });

    logger.info(`Order prepared: ${req.body.orderId} by user ${userId}`);
    res.json({ success: true, message: "order is prepared.", data: {} });
  } catch (error) {
    logger.error('Error preparing order:', error);
    res.json({
      success: false,
      message: "Error while setting datePrepared",
    });
  }
};

// Driver controllers
const acceptOrderByDriver = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const order = await orderModel.findById(req.body.orderId);

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permissions - only drivers or admins can accept delivery orders
    if (userRole !== 'admin' && userRole !== 'driver') {
      return res.json({
        success: false,
        message: "Only drivers can accept delivery orders.",
      });
    }

    if (order.stateGiven !== "by-store") {
      return res.json({
        success: false,
        message: "the order is not 'accepted by store'",
      });
    }

    const driverId = new mongoose.Types.ObjectId(userId);
    const currentBlacklist = order.idBlackList || [];
    if (currentBlacklist.some((id) => id.toString() === driverId.toString())) {
      return res.json({
        success: false,
        message: "You have previously denied this order and cannot accept it again",
      });
    }

    await orderModel.findByIdAndUpdate(req.body.orderId, {
      stateGiven: "by-driver",
      dateAccepted_byDriver: Date.now(),
      driver: driverId,
      status: "accepted-by-driver",
      datePickedup_byDriver_est: new Date(Date.now() + 600000), // 10 minutes
    });

    logger.info(`Order accepted by driver: ${req.body.orderId} by user ${userId}`);
    return res.json({
      success: true,
      message: `dateAccepted_byDriver: ${Date.now()}, status: accepted-by-driver`,
      data: {}
    });
  } catch (error) {
    logger.error('Error accepting order by driver:', error);
    const message = "ERROR.MESSAGE:____________ " + error.message;
    res.json({ success: false, message: message });
  }
};

const pickupOrder = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const order = await orderModel.findById(req.body.orderId);

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permissions - only the assigned driver or admin can pick up orders
    if (userRole !== 'admin' && order.driver?.toString() !== userId) {
      return res.json({
        success: false,
        message: "You don't have permission to pick up this order.",
      });
    }

    if (!order.isActive) {
      return res.json({
        success: false,
        message: "ERROR: the order is not activated yet.",
      });
    }
    if (order.status !== "prepared" || !order.isTakeout) {
      return res.json({
        success: false,
        message: "ERROR: the order is not ready to get picked up yet or is not 'takeout'.",
      });
    }

    await orderModel.findByIdAndUpdate(req.body.orderId, {
      datePickedup_byDriver: Date.now(),
      status: "pickedup",
      dateDelivered_byDriver_est: new Date(Date.now() + 600000), // 10 minutes
    });

    logger.info(`Order picked up: ${req.body.orderId} by user ${userId}`);
    res.json({ success: true, message: "pickupOrder got done", data: {} });
  } catch (error) {
    logger.error('Error picking up order:', error);
    res.json({
      success: false,
      message: "Error while pickupOrder",
    });
  }
};

const deliverOrderByDriver = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const order = await orderModel.findById(req.body.orderId);

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permissions - only the assigned driver or admin can deliver orders
    if (userRole !== 'admin' && order.driver?.toString() !== userId) {
      return res.json({
        success: false,
        message: "You don't have permission to deliver this order.",
      });
    }

    if (!order.isActive || !order.isTakeout) {
      return res.json({
        success: false,
        message: "ERROR: the order is not activated yet or is takeout.",
      });
    }

    await orderModel.findByIdAndUpdate(req.body.orderId, {
      dateDelivered_byDriver: Date.now(),
      status: "delivered",
      done: true,
    });

    logger.info(`Order delivered by driver: ${req.body.orderId} by user ${userId}`);
    res.json({
      success: true,
      message: "dateDelivered got Updated",
      data: {}
    });
  } catch (error) {
    logger.error('Error delivering order by driver:', error);
    res.json({
      success: false,
      message: "Error while setting dateDelivered",
    });
  }
};

// Listing functions
const userOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const orders = await orderModel
      .find({ user: userId })
      .populate("user", "username name avatar")
      .populate("store", "username name avatar locationLat locationLng")
      .populate("driver", "username name avatar locationLat locationLng")
      .sort({ datePlaced: -1 });
    res.json({ success: true, data: orders || [] });
  } catch (error) {
    logger.error('Error fetching user orders:', error);
    res.json({ success: false, message: "Error" });
  }
};

const storeOrders = async (req, res) => {
  try {
    const store = new mongoose.Types.ObjectId(req.userId);
    const orders = await orderModel
      .find({ store })
      .populate("user", "username name avatar")
      .populate("driver", "username name avatar locationLat locationLng")
      .sort({ datePlaced: -1 });
    res.json({ success: true, data: orders || [] });
  } catch (error) {
    logger.error('Error fetching store orders:', error);
    res.json({
      success: false,
      message: "Error while fetching orders",
      error: error.message
    });
  }
};

const driverOrders = async (req, res) => {
  try {
    const driverId = new mongoose.Types.ObjectId(req.userId);
    const orders = await orderModel
      .find({ driver: driverId })
      .populate("store", "username name avatar locationLat locationLng")
      .populate("user", "username name avatar")
      .sort({ datePlaced: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('Error fetching driver orders:', error);
    res.json({ success: false, message: "Error" });
  }
};

const getAvailableOrdersForDriver = async (req, res) => {
  try {
    const driverId = req.userId;
    const orders = await orderModel
      .find({
        isActive: true,
        isTakeout: true,
        stateGiven: "by-store",
        idBlackList: { $nin: [driverId] },
      })
      .populate("store", "username name avatar locationLat locationLng")
      .populate("user", "username name avatar")
      .sort({ datePlaced: -1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('Error fetching available orders for driver:', error);
    res.json({
      success: false,
      message: "Error fetching available orders for driver",
    });
  }
};

const getPendingOrders = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;

    if (!userId || userId === 'undefined') {
      return res.json({ success: false, message: "Invalid user ID provided" });
    }

    // Allow filtering by status via query params, default to ['placed', 'accepted', 'prepared']
    const statusFilter = req.query.status ? req.query.status.split(',') : ['placed', 'accepted', 'prepared'];

    const pendingOrders = await orderModel
      .find({
        user: userId,
        status: { $in: statusFilter },
        isActive: true
      })
      .populate("user", "username name avatar")
      .populate("store", "username name avatar locationLat locationLng")
      .populate("driver", "username name avatar locationLat locationLng")
      .sort({ datePlaced: -1 });

    res.json({ success: true, data: pendingOrders });
  } catch (error) {
    logger.error('Error fetching pending orders:', error);
    res.json({ success: false, message: "Error fetching pending orders" });
  }
};

const adjustPreparationTime = async (req, res) => {
  try {
    const { orderId, minutes } = req.body;
    const userRole = req.userRole;
    const userId = req.userId;
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "accepted" && order.status !== "accepted-by-driver") {
      return res.json({
        success: false,
        message: "Order not found or not in accepted state",
      });
    }

    if (order.store.toString() !== userId && userRole !== 'admin') {
       return res.json({
        success: false,
        message: "You dont have permission to adjust preparation time for this order.",
      });
    }

    const currentEst = order.datePrepared_byStore_est || new Date(Date.now() + 600000); // Default 10 min if not set
    const newEstTime = new Date(currentEst.getTime() + (minutes * 60000)); // minutes to milliseconds

    await orderModel.findByIdAndUpdate(orderId, {
      datePrepared_byStore_est: newEstTime,
    });

    logger.info(`Adjusted preparation time for order: ${orderId} by ${minutes} minutes`);
    res.json({
      success: true,
      message: `Preparation time ${minutes > 0 ? 'extended' : 'reduced'} by ${Math.abs(minutes)} minutes`,
      data: { newEstimatedTime: newEstTime }
    });
  } catch (error) {
    logger.error('Error adjusting preparation time:', error);
    res.json({
      success: false,
      message: "Error adjusting preparation time",
    });
  }
};

const adjustPickupTime = async (req, res) => {
  try {
    const { orderId, minutes } = req.body;
    const userId = req.userId;
    const userRole = req.userRole;
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permissions - only the assigned driver or admin can adjust pickup time
    if (userRole !== 'admin' && order.driver?.toString() !== userId) {
      return res.json({
        success: false,
        message: "You don't have permission to adjust pickup time for this order.",
      });
    }

    if (order.status !== "accepted" && order.status !== "accepted-by-driver") {
      return res.json({
        success: false,
        message: "Order not found or not in accepted state",
      });
    }

    const currentEst = order.datePickedup_byDriver_est || new Date(Date.now() + 600000); // Default 10 min if not set
    const newEstTime = new Date(currentEst.getTime() + (minutes * 60000)); // minutes to milliseconds

    await orderModel.findByIdAndUpdate(orderId, {
      datePickedup_byDriver_est: newEstTime,
    });

    logger.info(`Adjusted pickup time for order: ${orderId} by ${minutes} minutes by user ${userId}`);
    res.json({
      success: true,
      message: `Pickup time ${minutes > 0 ? 'extended' : 'reduced'} by ${Math.abs(minutes)} minutes`,
      data: { newEstimatedTime: newEstTime }
    });
  } catch (error) {
    logger.error('Error adjusting pickup time:', error);
    res.json({
      success: false,
      message: "Error adjusting pickup time",
    });
  }
};

const adjustDeliveryTime = async (req, res) => {
  try {
    const { orderId, minutes } = req.body;
    const userId = req.userId;
    const userRole = req.userRole;
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permissions - only the assigned driver or admin can adjust delivery time
    if (userRole !== 'admin' && order.driver?.toString() !== userId) {
      return res.json({
        success: false,
        message: "You don't have permission to adjust delivery time for this order.",
      });
    }

    if (order.status !== "pickedup") {
      return res.json({
        success: false,
        message: "Order not found or not in pickedup state",
      });
    }

    const currentEst = order.dateDelivered_byDriver_est || new Date(Date.now() + 600000); // Default 10 min if not set
    const newEstTime = new Date(currentEst.getTime() + (minutes * 60000)); // minutes to milliseconds

    await orderModel.findByIdAndUpdate(orderId, {
      dateDelivered_byDriver_est: newEstTime,
    });

    logger.info(`Adjusted delivery time for order: ${orderId} by ${minutes} minutes by user ${userId}`);
    res.json({
      success: true,
      message: `Delivery time ${minutes > 0 ? 'extended' : 'reduced'} by ${Math.abs(minutes)} minutes`,
      data: { newEstimatedTime: newEstTime }
    });
  } catch (error) {
    logger.error('Error adjusting delivery time:', error);
    res.json({
      success: false,
      message: "Error adjusting delivery time",
    });
  }
};

// Calculate progress percentages based on estimated times
const calculateOrderProgress = (order) => {
  const now = new Date();
  let progressPrepare = 0;
  let progressPickup = 0;
  let progressDeliver = 0;
  let minutesLeftPrepare = null;
  let minutesLeftPickup = null;
  let minutesLeftDeliver = null;

  // Calculate preparation progress
  if (order.datePrepared_byStore_est) {
    const estTime = new Date(order.datePrepared_byStore_est);
    const startTime = new Date(order.dateAccepted_byStore || order.datePlaced);

    // Preparation is 100% complete when order status is 'prepared' or later
    if (order.status === 'prepared' || order.status === 'pickedup' || order.status === 'delivered' || order.status === 'received') {
      progressPrepare = 100;
    } else {
      const totalMs = estTime.getTime() - startTime.getTime();
      const elapsedMs = now.getTime() - startTime.getTime();
      // Only calculate progress if we have a valid time range
      if (totalMs > 0 && elapsedMs >= 0) {
        progressPrepare = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
      }
    }

    const timeLeftMs = estTime.getTime() - now.getTime();
    minutesLeftPrepare = Math.max(0, Math.ceil(timeLeftMs / (1000 * 60)));
  }

  // Calculate pickup progress (for drivers)
  if (order.datePickedup_byDriver_est && order.driver) {
    const estTime = new Date(order.datePickedup_byDriver_est);
    const startTime = new Date(order.dateAccepted_byDriver || order.datePlaced);

    // Pickup is 100% complete when order status is 'pickedup' or later
    if (order.status === 'pickedup' || order.status === 'delivered' || order.status === 'received') {
      progressPickup = 100;
    } else {
      const totalMs = estTime.getTime() - startTime.getTime();
      const elapsedMs = now.getTime() - startTime.getTime();
      // Only calculate progress if we have a valid time range
      if (totalMs > 0 && elapsedMs >= 0) {
        progressPickup = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
      }
    }

    const timeLeftMs = estTime.getTime() - now.getTime();
    minutesLeftPickup = Math.max(0, Math.ceil(timeLeftMs / (1000 * 60)));
  }

  // Calculate delivery progress
  if (order.dateDelivered_byDriver_est && order.driver) {
    const estTime = new Date(order.dateDelivered_byDriver_est);
    const startTime = new Date(order.datePickedup_byDriver || order.dateAccepted_byDriver);

    // Delivery is 100% complete when order status is 'delivered' or 'received'
    if (order.status === 'delivered' || order.status === 'received') {
      progressDeliver = 100;
    } else {
      const totalMs = estTime.getTime() - startTime.getTime();
      const elapsedMs = now.getTime() - startTime.getTime();
      // Only calculate progress if we have a valid time range
      if (totalMs > 0 && elapsedMs >= 0) {
        progressDeliver = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
      }
    }

    const timeLeftMs = estTime.getTime() - now.getTime();
    minutesLeftDeliver = Math.max(0, Math.ceil(timeLeftMs / (1000 * 60)));
  }

  return {
    progressPrepare: Math.round(progressPrepare),
    progressPickup: Math.round(progressPickup),
    progressDeliver: Math.round(progressDeliver),
    minutesLeftPrepare,
    minutesLeftPickup,
    minutesLeftDeliver
  };
};

// Update progress for a specific order
const updateOrderProgress = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    const progress = calculateOrderProgress(order);

    await orderModel.findByIdAndUpdate(orderId, progress);

    res.json({
      success: true,
      data: { ...order.toObject(), ...progress }
    });
  } catch (error) {
    logger.error('Error updating order progress:', error);
    res.json({ success: false, message: "Error updating progress" });
  }
};

// Get real-time progress for multiple orders
const getOrdersProgress = async (req, res) => {
  try {
    const { orderIds } = req.body; // Array of order IDs

    if (!orderIds || !Array.isArray(orderIds)) {
      return res.json({ success: false, message: "orderIds array required" });
    }

    const orders = await orderModel.find({ _id: { $in: orderIds } });

    const progressData = orders.map(order => {
      const progress = calculateOrderProgress(order);
      return {
        _id: order._id,
        ...progress
      };
    });

    res.json({ success: true, data: progressData });
  } catch (error) {
    logger.error('Error getting orders progress:', error);
    res.json({ success: false, message: "Error getting progress" });
  }
};

const allOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    if (!userId || userRole !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const orders = await orderModel.find({})
      .populate("store", "username name avatar locationLat locationLng")
      .populate("user", "username name avatar")
      .populate("driver", "username name avatar locationLat locationLng")
      .sort({ datePlaced: -1 });

    logger.info(`Admin ${user.username} fetched ${orders.length} orders`);
    res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('Error fetching all orders:', error);
    res.json({ success: false, message: "Error: fetching orders" });
  }
};

// Add customer feedback to order
const addCustomerFeedback = async (req, res) => {
  try {
    const { orderId, rating, comment, reactions } = req.body;
    const userId = req.userId;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.user.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to add feedback for this order" });
    }

    if (order.status !== "delivered" && order.status !== "received") {
      return res.status(400).json({ success: false, message: "Order must be delivered or received to add feedback" });
    }

    // Validate rating range manually
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }

    const updateData = {};
    if (rating !== undefined) updateData.customerRating = rating;
    if (comment !== undefined) updateData.customerComment = comment;
    if (reactions !== undefined) updateData.customerReactions = reactions;

    const updatedOrder = await orderModel.findByIdAndUpdate(orderId, updateData, { new: true });

    logger.info(`Customer feedback added to order: ${orderId}`);
    res.json({ success: true, message: "Feedback added successfully" });
  } catch (error) {
    logger.error('Error adding customer feedback:', error);
    res.status(500).json({ success: false, message: "Error adding feedback" });
  }
};

const getStoreOrderCounts = async (req, res) => {
  try {
    const storeId = req.userId;
    const placedCount = await orderModel.countDocuments({ store: storeId, status: 'placed', isActive: true });
    const acceptedCount = await orderModel.countDocuments({ store: storeId, status: 'accepted', isActive: true });
    res.json({ success: true, placed: placedCount, accepted: acceptedCount });
  } catch (error) {
    logger.error('Error fetching store order counts:', error);
    res.json({ success: false, message: error.message });
  }
};

// Unified dashboard statistics endpoint for all user roles
const getDashboardStatistics = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    
    
    if (!userId || !userRole) {
      // For dashboard stats, return default stats for unauthenticated users
      const defaultStats = {
        orders: 0,
        revenue: 0,
        customers: 0,
        products: 0,
        placedOrders: 0,
        acceptedOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        unreadMessages: 0,
      };
      
      logger.info(`Dashboard stats returned with default values for unauthenticated request`);
      return res.json({ success: true, data: defaultStats });
    }

    const stats = {
      orders: 0,
      revenue: 0,
      customers: 0,
      products: 0,
      placedOrders: 0,
      acceptedOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      unreadMessages: 0,
    };

    // Fetch data based on user role
    if (userRole === 'admin') {
      // Admin gets platform-wide statistics
      const allOrders = await orderModel.find({});
      const allUsers = await userModel.find({});
      const allProducts = await productModel.find({});
      
      stats.orders = allOrders.length;
      stats.revenue = allOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
      stats.customers = allUsers.length;
      stats.products = allProducts.length;
      stats.placedOrders = allOrders.filter(order => order.status === 'placed').length;
      stats.acceptedOrders = allOrders.filter(order => order.status === 'accepted').length;
      stats.completedOrders = allOrders.filter(order => order.status === 'delivered' || order.status === 'received').length;
      stats.pendingOrders = stats.placedOrders + stats.acceptedOrders;

    } else if (userRole === 'store') {
      // Store gets their own orders and products
      const storeOrders = await orderModel.find({ store: userId });
      const storeProducts = await productModel.find({ store: userId });
      
      stats.orders = storeOrders.length;
      stats.revenue = storeOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
      stats.products = storeProducts.length;
      stats.placedOrders = storeOrders.filter(order => order.status === 'placed').length;
      stats.acceptedOrders = storeOrders.filter(order => order.status === 'accepted').length;
      stats.completedOrders = storeOrders.filter(order => order.status === 'delivered' || order.status === 'received').length;
      stats.pendingOrders = stats.placedOrders + stats.acceptedOrders;

    } else if (userRole === 'driver') {
      // Driver gets their delivery statistics
      const driverOrders = await orderModel.find({ driver: userId });

      stats.orders = driverOrders.length;
      stats.revenue = driverOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
      stats.pendingOrders = driverOrders.filter(order => order.status === 'accepted' || order.status === 'accepted-by-driver' || order.status === 'prepared').length;
      stats.completedOrders = driverOrders.filter(order => order.status === 'delivered' || order.status === 'received').length;

      // Count available orders for this driver
      const availableOrders = await orderModel.countDocuments({
        isActive: true,
        isTakeout: true,
        stateGiven: "by-store",
        idBlackList: { $nin: [userId] },
      });
      stats.availableOrders = availableOrders;

    } else if (userRole === 'customer') {
      // Customer gets their order history
      const customerOrders = await orderModel.find({ user: userId });
      
      stats.orders = customerOrders.length;
      stats.revenue = customerOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
      stats.pendingOrders = customerOrders.filter(order => order.status === 'placed' || order.status === 'accepted' || order.status === 'prepared').length;
      stats.completedOrders = customerOrders.filter(order => order.status === 'delivered' || order.status === 'received').length;
    }

    logger.info(`Dashboard statistics fetched for user ${userId} (role: ${userRole})`);
    res.json({ success: true, data: stats });

  } catch (error) {
    logger.error('Error fetching dashboard statistics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get guest orders by session ID
const getGuestOrders = async (req, res) => {
  try {
    // Get session ID from x-session-id header (new approach)
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || req.body.sessionId;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Session ID is required" });
    }

    const orders = await orderModel
      .find({ guestSessionId: sessionId })
      .populate("store", "username name avatar locationLat locationLng")
      .populate("driver", "username name avatar locationLat locationLng")
      .sort({ datePlaced: -1 });

    res.json({ success: true, data: orders || [] });
  } catch (error) {
    logger.error('Error fetching guest orders:', error);
    res.json({ success: false, message: "Error fetching guest orders" });
  }
};

// Guest order cancellation
const cancelGuestOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    // Get session ID from x-session-id header (new approach)
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || req.body.sessionId;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
        isGuest: true
      });
    }

    // Validate order belongs to guest session
    const order = await orderModel.findOne({
      _id: orderId,
      guestSessionId: sessionId,
      isActive: true
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or doesn't belong to this session",
        isGuest: true
      });
    }

    // Check if order can be canceled
    if (order.status !== "placed" && order.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order in ${order.status} state`,
        isGuest: true
      });
    }

    // Update order status
    await orderModel.findByIdAndUpdate(orderId, {
      status: "canceled by guest",
      dateCanceled_byCustomer: Date.now(),
      isActive: false,
      cancel: true
    });

    logger.info(`Guest order canceled: ${orderId} for session ${sessionId}`);
    res.json({
      success: true,
      message: "Order canceled successfully",
      isGuest: true
    });

  } catch (error) {
    logger.error('Error canceling guest order:', error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
      isGuest: true
    });
  }
};

// Guest order progress tracking
const getGuestOrderProgress = async (req, res) => {
  try {
    const { orderId } = req.params;
    // Get session ID from x-session-id header (new approach)
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || req.body.sessionId;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
        isGuest: true
      });
    }

    // Verify order belongs to guest
    const order = await orderModel.findOne({
      _id: orderId,
      guestSessionId: sessionId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        isGuest: true
      });
    }

    const progress = calculateOrderProgress(order);

    res.json({
      success: true,
      data: {
        ...order.toObject(),
        ...progress
      },
      isGuest: true
    });

  } catch (error) {
    logger.error('Error getting guest order progress:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get order progress",
      error: error.message,
      isGuest: true
    });
  }
};

// Mark order as paid
const markOrderAsPaid = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.userId;
    const userRole = req.userRole;

    if (!orderId) {
      return res.json({
        success: false,
        message: "Order ID is required"
      });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.json({
        success: false,
        message: "Order not found"
      });
    }

    // Check permissions - only the customer who placed the order or admin can mark as paid
    if (userRole !== 'admin' && order.user.toString() !== userId) {
      return res.json({
        success: false,
        message: "You don't have permission to mark this order as paid."
      });
    }

    if (order.payment === true) {
      return res.json({
        success: false,
        message: "Order is already marked as paid"
      });
    }

    await orderModel.findByIdAndUpdate(orderId, {
      payment: true
    });

    logger.info(`Order marked as paid: ${orderId} by user ${userId}`);
    res.json({
      success: true,
      message: "Order marked as paid successfully"
    });
  } catch (error) {
    logger.error('Error marking order as paid:', error);
    res.json({
      success: false,
      message: "Error marking order as paid"
    });
  }
};

// Mark order as unpaid
const markOrderAsUnpaid = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.userId;
    const userRole = req.userRole;

    if (!orderId) {
      return res.json({
        success: false,
        message: "Order ID is required"
      });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.json({
        success: false,
        message: "Order not found"
      });
    }

    // Check permissions - only the customer who placed the order or admin can mark as unpaid
    if (userRole !== 'admin' && order.user.toString() !== userId) {
      return res.json({
        success: false,
        message: "You don't have permission to mark this order as unpaid."
      });
    }

    if (order.payment === false) {
      return res.json({
        success: false,
        message: "Order is already marked as unpaid"
      });
    }

    await orderModel.findByIdAndUpdate(orderId, {
      payment: false
    });

    logger.info(`Order marked as unpaid: ${orderId} by user ${userId}`);
    res.json({
      success: true,
      message: "Order marked as unpaid successfully"
    });
  } catch (error) {
    logger.error('Error marking order as unpaid:', error);
    res.json({
      success: false,
      message: "Error marking order as unpaid"
    });
  }
};

export {
  placeOrder,
  acceptOrderByStore,
  rejectOrderByStore,
  cancelOrder,
  prepareOrder,
  pickupOrder,
  acceptOrderByDriver,
  userOrders,
  driverOrders,
  storeOrders,
  getPendingOrders,
  allOrders,
  receiveOrderByCustomer,
  deliverOrderByDriver,
  getAvailableOrdersForDriver,
  adjustPreparationTime,
  adjustPickupTime,
  adjustDeliveryTime,
  updateOrderProgress,
  getOrdersProgress,
  calculateOrderProgress,
  addCustomerFeedback,
  getStoreOrderCounts,
  getGuestOrders,
  cancelGuestOrder,
  getGuestOrderProgress,
  getDashboardStatistics,
  markOrderAsPaid,
  markOrderAsUnpaid,
};