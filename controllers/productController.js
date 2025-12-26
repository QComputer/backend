import productModel from "../models/productModel.js";
import userModel from "../models/userModel.js";
import categoryModel from "../models/categoryModel.js";
import productReactionModel from "../models/productReactionModel.js";
import mongoose from "mongoose";
import winston from "winston";
import { uploadImageToDisk } from "../utils/imageUpload.js";
import { createErrorResponse, createSuccessResponse } from "../utils/errorUtils.js";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Add request logging middleware
const logRequest = (req, res, next) => {
  logger.debug(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    headers: req.headers,
    body: req.body,
    params: req.params,
    query: req.query
  });
  next();
};
// Get product by id
const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productModel.findById(id)

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // add category name
    const category = await categoryModel.findById(product.category)
    let categoryName = 'uncategorized';
    if (category) {
      categoryName = category.name;
    }

    // Get store information
    const store = await userModel.findById(product.store);
    let storeUsername = 'unknown';
    let storeName = 'Unknown Seller';
    if (store) {
      storeUsername = store.username;
      storeName = store.name || storeUsername;
    }

    const productData = product.toObject();
    productData.categoryName = categoryName;
    productData.storeUserName = storeUsername;

    res.json({ success: true, data: productData });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Error fetching product" });
  }
};

// add product item to products list
const addProduct = async (req, res) => {
  try {
    const userId = req.userId;

    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
        field: "name"
      });
    }

    if (!req.body.price) {
      return res.status(400).json({
        success: false,
        message: "Product price is required",
        field: "price"
      });
    }

    if (req.body.price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product price must be greater than 0",
        field: "price"
      });
    }

    // Fetch user to get username
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "store") {
      return res.status(403).json({
        success: false,
        message: "Only store users can create products",
      });
    }

    // Handle image upload if a file is provided
    let imageUrl = null;
    if (req.file) {
      try {
        imageUrl = await uploadImageToDisk(req.file.buffer, req.file.originalname, req.file.mimetype);
      } catch (uploadError) {
        console.log('=== IMAGE SERVICE FALLBACK ===');
        console.log(`Image service unavailable (${uploadError.message}), using data URL fallback`);
        // Fallback: create data URL from buffer
        const base64 = req.file.buffer.toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
        imageUrl = dataUrl;
        console.log(`Data URL created for product image: ${dataUrl.substring(0, 50)}...`);
      }
    }

    // Handle category - could be ID or name
    let categoryId = req.body.category;
    if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
      // Look up category by name for this user
      const categoryDoc = await categoryModel.findOne({ name: categoryId, store: userId });
      if (categoryDoc) {
        categoryId = categoryDoc._id;
      } else {
        // Create new category if it doesn't exist
        const newCategory = new categoryModel({
          name: categoryId,
          store: userId,
        });
        await newCategory.save();
        categoryId = newCategory._id;
      }
    }

    const product = new productModel({
      name: req.body.name,
      store: userId,
      description: req.body.description,
      price: req.body.price,
      currency: req.body.currency || 'IRT',
      category: categoryId,
      image: imageUrl || req.body.image || null,
      label: req.body.label,
      available: req.body.available === true || req.body.available === "true",
      ratings: req.body.ratings || 0,
      stock: req.body.stock || 0,
      tags: req.body.tags
        ? req.body.tags.split(",").map((tag) => tag.trim())
        : [],
      brand: req.body.brand,
      sku: req.body.sku,
      barcode: req.body.barcode,
      weight: req.body.weight,
      dimensions: req.body.dimensions,
    });

    await product.save();
    logger.info(`Product added: ${product.name} by ${user.username}`);
    res.json({
      success: true,
      message: "Product created successfully",
      data: product
    });
  } catch (error) {
    logger.error('Error adding product:', error);
    console.error('Detailed product creation error:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.userId
    });

    // Handle specific MongoDB validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Error adding product",
      error: error.message
    });
  }
};

//  product list for store
const listProduct = async (req, res) => {
  try {
    const userId = req.userId;

    const products = await productModel
      .find({ store: userId })
      .populate('category', 'name _id'); // Populate category name for filtering
    res.json({ success: true, data: products });
  } catch (error) {
    logger.error('Error listing products:', error);
    res.json({ success: false, message: "Error" });
  }
};

// public list product by storeId
const publicListProduct = async (req, res) => {
  try {
    const storeId = req.params.storeId
    const products = await productModel
      .find({ store: storeId, available: true })
      .populate('category', 'name');
    res.json({ success: true, data: products });
  } catch (error) {
    logger.error('Error listing public products:', error);
    res.status(500).json({ success: false, message: "Error" });
  }
};

// remove product item
const removeProduct = async (req, res) => {
  try {
    const product = await productModel.findById(req.params.id);
    if (!product || !(product.store.toString() === req.userId || req.userRole === 'admin')) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found in your list" });
    }

    await productModel.findByIdAndDelete(req.params.id);
    logger.info(`Product removed: ${product.name}`);
    res.json({ success: true, message: "Product Removed" });
  } catch (error) {
    logger.error('Error removing product:', error);
    res.json({ success: false, message: "Error" });
  }
};

// edit product item (admin or owner)
const editProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      currency,
      category,
      label,
      available,
      stock,
      tags,
      brand,
      sku,
      barcode,
      weight,
      dimensions,
      image,
    } = req.body;
    const product = await productModel.findById(req.params.id);
    const userId = req.userId;
    const userRole = req.userRole;

    logger.info(`Edit product request: categoryId=${req.params.id}, authUserId=${userId}, userRole=${userRole}`);
    logger.info(`Request body:`, req.body);

    if (!product) {
      logger.error(`Product not found: ${req.params.id}`);
      return res
        .status(404)
        .json({ success: false, message: "Product not found in your list" });
    }

    logger.info(`Product found: ${product._id}, store: ${product.store}, authUserId: ${userId}`);

    // Ownership validation - check if authenticated user owns the product
    if (userRole !== 'admin' && product.store.toString() !== userId) {
      logger.error(`Ownership validation failed: product.store=${product.store.toString()}, authUserId=${userId}`);
      return res
        .status(403)
        .json({ success: false, message: "You can only edit your own products" });
    }

    // Handle image upload if a new image file is provided
    let imageUrl = (typeof image === 'string' && image.trim()) ? image : product.image; // Use existing image if no valid new one provided
    if (req.file) {
      try {
        imageUrl = await uploadImageToDisk(req.file.buffer, req.file.originalname, req.file.mimetype);
      } catch (uploadError) {
        console.log('=== IMAGE SERVICE FALLBACK ===');
        console.log(`Image service unavailable (${uploadError.message}), using data URL fallback`);
        // Fallback: create data URL from buffer
        const base64 = req.file.buffer.toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
        imageUrl = dataUrl;
        console.log(`Data URL created for product image: ${dataUrl.substring(0, 50)}...`);
      }
    }

    // Update fields if provided with proper type conversion
    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = parseFloat(price);
    if (currency) product.currency = currency;
    if (category) {
      // Handle category - could be ID or name
      if (mongoose.Types.ObjectId.isValid(category)) {
        product.category = category;
      } else {
        // Look up category by name for this product's store
        const categoryDoc = await categoryModel.findOne({ name: category, store: product.store });
        if (categoryDoc) {
          product.category = categoryDoc._id;
        } else {
          // Create new category if it doesn't exist
          const newCategory = new categoryModel({
            name: category?.name || category,
            store: product.store,
          });
          await newCategory.save();
          product.category = newCategory._id;
        }
      }
    }
    if (label) product.label = label;
    if (available !== undefined) product.available = String(available) === "true";
    if (stock !== undefined) product.stock = parseInt(stock) || 0;
    if (tags) product.tags = tags.split(",").map((tag) => tag.trim());
    if (brand) product.brand = brand;
    if (sku) product.sku = sku;
    if (barcode) product.barcode = barcode;
    if (weight) product.weight = weight;
    if (dimensions) product.dimensions = dimensions;
    if (typeof imageUrl === 'string' && imageUrl.trim()) product.image = imageUrl;

    product.updatedAt = new Date();

    const updatedProduct = await product.save();

    logger.info(`Product updated: ${product.name}`);
    res.json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    logger.error('Error updating product:', error);
    res.status(500).json({ success: false, message: error.message || "Error updating product" });
  }
};

// get all products (role-based)
const getAllProducts = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    console.log('getAllProducts called with userId:', userId, 'with role:', userRole);

    let query = {};
    if (userRole === 'admin') {
      // Admin sees all products
      query = {};
      console.log('Admin query: all products');
    } else if (userRole === 'store') {
      // Store sees all their products
      query = { store: userId };
      console.log('Store query:', query);
    } else {
      // Customer/Driver see only available products
      query = { available: true };
      console.log('Customer/Driver query:', query);
    }

    console.log('Executing query:', JSON.stringify(query));
    const products = await productModel
      .find(query)
      .populate('store', 'name username') // Populate store with name and username
      .populate('category', 'name') // Populate category with name
      .sort({ createdAt: -1 });
    console.log('Products found:', products.length);
    console.log('Total products in database:', await productModel.countDocuments());
    if (products.length > 0) {
      console.log('Sample product:', {
        id: products[0]._id,
        name: products[0].name,
        store: products[0].store?.username,
        category: products[0].category?.name
      });
    } else {
      console.log('No products match the query. Checking if any products exist...');
      const allProducts = await productModel.find({}).limit(5);
      console.log('First 5 products in DB:', allProducts.map(p => ({ id: p._id, name: p.name, store: p.store })));
    }
    res.json({ success: true, data: products });
  } catch (error) {
    logger.error('Error fetching all products:', error);
    console.error('Full error:', error);
    res.json({ success: false, message: "Error" });
  }
};

// Get products for cart (includes products that might not be normally visible to user)
const getCartProducts = async (req, res) => {
  try {
    const userId = req.userId;
    const productIds = req.body.productIds; // Array of product IDs in cart

    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({ success: false, message: "productIds array required" });
    }

    console.log('getCartProducts called for user:', userId, 'with productIds:', productIds);

    // Get all requested products regardless of availability or user permissions
    // This ensures cart items are always visible to the user who has them in cart
    const products = await productModel
      .find({ _id: { $in: productIds } })
      .populate('store', 'name username') // Populate store with name and username
      .populate('category', 'name') // Populate category with name
      .sort({ createdAt: -1 });

    console.log('Cart products found:', products.length);
    res.json({ success: true, data: products });
  } catch (error) {
    logger.error('Error fetching cart products:', error);
    console.error('Full error:', error);
    res.json({ success: false, message: "Error fetching cart products" });
  }
};

// Public product endpoints (no authentication required)
// Get public product by ID (for public menu viewing)
const getPublicProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await productModel.findById(productId);

    if (!product || !product.available) {
      return res.json({ success: false, message: "Product not found or not available" });
    }

    // add category name
    const category = await categoryModel.findById(product.category);
    let categoryName = 'uncategorized';
    if (category) {
      categoryName = category.name;
    }

    // Get store information (public data only)
    const store = await userModel.findById(product.store);
    let storeUsername = 'unknown';
    let storeName = 'Unknown Seller';
    if (store) {
      storeUsername = store.username;
      storeName = store.name || storeUsername;
    }

    const productData = product.toObject();
    productData.categoryName = categoryName;
    productData.storeUserName = storeUsername;
    productData.storeName = storeName;
    productData.storeName = storeName;

    res.json({ success: true, data: productData });
  } catch (error) {
    logger.error('Error fetching public product:', error);
    res.json({ success: false, message: "Error fetching product" });
  }
};

// Get all public products (for public menu viewing)
const getPublicProducts = async (req, res) => {
  try {
    const { category, search, limit = 100, page = 1 } = req.query;
    const { storeId } = req.params;
    let query = { available: true }; // Only show available products

    // Filter by store if provided
    if (storeId) {
      query.store = storeId;
    } else {
      res.json({ success: false, message: "storeId is reqiered." });
    }

    // Filter by category if provided
    if (category) {
      query.category = category;
    }

    // Search by name or description if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const skip = (page - 1) * limit;

    const products = await productModel
      .find(query)
      .populate('store', 'name username') // Populate store with name and username
      .populate('category', 'name') // Populate category with name
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await productModel.countDocuments(query);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching public products:', error);
    res.json({ success: false, message: "Error fetching products" });
  }
};

// Map reaction types to product schema field names
const getReactionField = (reaction) => {
  const mapping = {
    'like': 'likes',
    'dislike': 'dislikes',
    'love': 'love',
    'laugh': 'laugh',
    'angry': 'angry',
    'sad': 'sad'
  };
  return mapping[reaction] || reaction;
};

// Add or update product reaction
const addProductReaction = async (req, res) => {
  const startTime = Date.now();
  console.log(`Starting addProductReaction for user ${req.body.userId || req.user?.userId}, product ${req.body.productId}, reaction ${req.body.reaction}`);

  let useTransactions = false;
  let session = null;
  let transactionError = false;

  // Try to use transactions if available (production), otherwise fall back to non-transactional operations
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransactions = true;
    console.log('Using MongoDB transactions');
  } catch (error) {
    console.log('Transactions not available, falling back to non-transactional operations:', error.message);
    if (session) {
      session.endSession();
      session = null;
    }
  }

  const performOperation = async (useSession = false) => {
    // Extract userId from the authenticated request
    const userId = req.userId || req.user?.id;
    const { productId, reaction } = req.body;

    if (!userId || !productId || !reaction) {
      console.log('Missing required fields in addProductReaction');
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      console.log(`Invalid productId format: ${productId}`);
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const product = await productModel.findById(productId).session(useSession ? session : null);
    if (!product) {
      console.log(`Product not found: ${productId}`);
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    console.log(`Initial product reactions:`, product.reactions);

    // Ensure product has reactions object initialized with proper defaults
    if (!product.reactions) {
      product.reactions = {
        likes: 0,
        dislikes: 0,
        love: 0,
        laugh: 0,
        angry: 0,
        sad: 0
      };
      console.log('Initialized reactions object');
    } else {
      // Ensure all reaction types exist
      const reactionTypes = ['likes', 'dislikes', 'love', 'laugh', 'angry', 'sad'];
      let initialized = false;
      reactionTypes.forEach(type => {
        if (typeof product.reactions[type] !== 'number') {
          product.reactions[type] = 0;
          initialized = true;
        }
      });
      if (initialized) console.log('Fixed missing reaction types');
    }

    // Save the product to ensure reactions object is properly initialized
    await product.save(useSession ? { session } : {});
    console.log(`Product saved with reactions:`, product.reactions);

    // Check if user already reacted to this product
    const existingReaction = await productReactionModel.findOne({ user: userId, product: productId }).session(useSession ? session : null);
    console.log(`Existing reaction found:`, existingReaction ? existingReaction.reaction : 'none');

    // Get the field names for the reactions
    const oldReactionField = existingReaction ? getReactionField(existingReaction.reaction) : null;
    const newReactionField = getReactionField(reaction);
    console.log(`Reaction fields: old=${oldReactionField}, new=${newReactionField}`);

    if (existingReaction) {
      // Update existing reaction
      const oldReaction = existingReaction.reaction;
      existingReaction.reaction = reaction;
      existingReaction.updatedAt = new Date();
      await existingReaction.save(useSession ? { session } : {});
      console.log(`Updated existing reaction from ${oldReaction} to ${reaction}`);

      // Update product counters atomically
      if (oldReaction !== reaction) {
        console.log(`Updating counters: decrement ${oldReactionField}, increment ${newReactionField}`);
        // Use findByIdAndUpdate instead of updateOne for better reliability
        const updatedProduct = await productModel.findByIdAndUpdate(
          productId,
          {
            $inc: {
              [`reactions.${oldReactionField}`]: -1,
              [`reactions.${newReactionField}`]: 1
            }
          },
          { new: true, ...(useSession ? { session } : {}) }
        );
        console.log(`Updated product reactions (change):`, updatedProduct.reactions);
      } else {
        console.log('Reaction unchanged, no counter update needed');
      }
    } else {
      // Create new reaction
      console.log('Creating new reaction');
      const newReaction = new productReactionModel({
        user: userId,
        product: productId,
        reaction
      });
      await newReaction.save(useSession ? { session } : {});
      console.log('New reaction saved');

      // Use findByIdAndUpdate instead of updateOne for better reliability
      console.log(`Incrementing ${newReactionField} counter`);
      const updatedProduct = await productModel.findByIdAndUpdate(
        productId,
        { $inc: { [`reactions.${newReactionField}`]: 1 } },
        { new: true, ...(useSession ? { session } : {}) }
      );
      console.log(`Updated product reactions (new):`, updatedProduct.reactions);
    }

    // Commit the transaction if used
    if (useSession) {
      await session.commitTransaction();
      console.log('Transaction committed successfully');
    }

    // Verify the update was successful by fetching the updated product with fresh data (outside transaction)
    const finalProduct = await productModel.findById(productId).lean();
    console.log(`Final product reactions:`, finalProduct.reactions);
    console.log(`Operation completed in ${Date.now() - startTime}ms`);

    // Ensure the reactions are properly returned
    res.json({
      success: true,
      message: "Reaction added successfully",
      data: { reactions: finalProduct.reactions }
    });
  };

  try {
    await performOperation(useTransactions);
  } catch (error) {
    console.log('Error in transaction mode, attempting retry without transactions:', error.message);
    if (useTransactions && !transactionError) {
      transactionError = true;
      useTransactions = false;
      if (session) {
        session.endSession();
        session = null;
      }
      try {
        await performOperation(false);
      } catch (retryError) {
        console.log('Error in non-transaction mode:', {
          error: retryError.message,
          stack: retryError.stack,
          userId: req.body.userId || req.user?.userId,
          productId: req.body.productId,
          reaction: req.body.reaction,
          duration: Date.now() - startTime
        });
        res.status(500).json({ success: false, message: "Error adding reaction" });
      }
    } else {
      console.log('Error adding product reaction:', {
        error: error.message,
        stack: error.stack,
        userId: req.body.userId || req.user?.userId,
        productId: req.body.productId,
        reaction: req.body.reaction,
        duration: Date.now() - startTime
      });
      res.status(500).json({ success: false, message: "Error adding reaction" });
    }
  } finally {
    if (session) session.endSession();
  }
};

// Remove product reaction
const removeProductReaction = async (req, res) => {
  console.log('removeProductReaction called with req.userId:', req.userId, 'req.body:', req.body);
  try {
    const userId = req.userId; // authenticated user
    const { productId } = req.body;

    console.log('userId:', userId, 'productId:', productId);

    if (!userId || !productId) {
      console.log('Missing required fields');
      return res.status(400).json(createErrorResponse("Missing required fields", 400));
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      console.log('Invalid productId format');
      return res.status(404).json(createErrorResponse("Product not found", 404));
    }

    const existingReaction = await productReactionModel.findOne({ user: userId, product: productId });
    console.log('existingReaction:', existingReaction);
    if (!existingReaction) {
      console.log('Reaction not found');
      return res.status(404).json(createErrorResponse("Reaction not found", 404));
    }

    const reactionType = existingReaction.reaction;
    const reactionField = getReactionField(reactionType);
    console.log('reactionType:', reactionType, 'reactionField:', reactionField);

    // Remove reaction
    await productReactionModel.findByIdAndDelete(existingReaction._id);
    console.log('Reaction deleted from database');

    // Use findByIdAndUpdate instead of updateOne for better reliability
    const updatedProduct = await productModel.findByIdAndUpdate(
      productId,
      { $inc: { [`reactions.${reactionField}`]: -1 } },
      { new: true }
    );
    console.log('Updated product reactions:', updatedProduct.reactions);

    // Verify the update was successful
    console.log(`Final product reactions after removal:`, updatedProduct.reactions);

    res.json({
      success: true,
      message: "Reaction removed successfully",
      data: { reactions: updatedProduct.reactions }
    });
  } catch (error) {
    console.log('Error in removeProductReaction:', error);
    logger.error('Error removing product reaction:', error);
    res.status(500).json(createErrorResponse("Error removing reaction", 500, error));
  }
};

// Get user's reaction for a product
const getProductReaction = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const reaction = await productReactionModel.findOne({ user: userId, product: productId });

    res.json({
      success: true,
      data: reaction ? { reaction: reaction.reaction } : null
    });
  } catch (error) {
    logger.error('Error getting product reaction:', error);
    res.status(500).json({ success: false, message: "Error getting reaction" });
  }
};

// Get products with categories combined (optimized for Products page)
const getProductsWithCategories = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    // Fetch products based on user role
    let productsQuery = {};
    if (userRole === 'admin') {
      productsQuery = {};
    } else if (userRole === 'store') {
      productsQuery = { store: userId };
    } else {
      productsQuery = { available: true };
    }

    const products = await productModel
      .find(productsQuery)
      .populate('store', 'name username')
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    // Fetch categories based on user role
    let categoriesQuery = {};
    if (userRole === 'store') {
      categoriesQuery = { store: userId };
    } else if (userRole === 'admin') {
      categoriesQuery = {};
    } else {
      categoriesQuery = {};
    }

    const categories = await categoryModel.find(categoriesQuery).sort({ name: 1 });

    res.json({
      success: true,
      data: { products, categories }
    });
  } catch (error) {
    logger.error('Error fetching products with categories:', error);
    res.status(500).json({ success: false, message: "Error fetching data" });
  }
};

export {
  addProduct,
  listProduct,
  removeProduct,
  editProduct,
  publicListProduct,
  getAllProducts,
  getCartProducts,
  getProduct,
  // Public product functions
  getPublicProduct,
  getPublicProducts,
  // Optimized endpoint
  getProductsWithCategories,
  // Reaction functions
  addProductReaction,
  removeProductReaction,
  getProductReaction
};