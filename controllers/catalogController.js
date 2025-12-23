import catalogModel from "../models/catalogModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import catalogDesignModel from "../models/catalogDesignModel.js";
import winston from "winston";
import qrcode from "qrcode";
import guestUserService from "../services/guestUserService.js";

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

// Create a new catalog
const createCatalog = async (req, res) => {
  try {
    const { name, description, productIds = [], isPublic, theme, design, useCustomDesign } = req.body;

    // Verify user
    if (!req.userId && (req.userRole !== "admin" && req.userRole !== "store" && req.userRole !== "staff") ) {
      return res.status(403).json({
        success: false,
        message: "Only admin, store, or staff users can create catalogs",
      });
    }
    let store = req.userId;
    if (req.userRole === 'staff') {
      const staff = await userModel.findById(req.userId);
      store = staff.store;
    }
    // Verify products exist
    console.log('Product verification - productIds:', productIds);

    const products = await productModel.find({
      _id: { $in: productIds },
      store: store
    });

    console.log('Product verification - found products:', products.length);

    if (productIds.length > 0 && products.length !== productIds.length) {
      console.log('Product verification failed - expected:', productIds.length, 'found:', products.length);
      return res.status(400).json({
        success: false,
        message: "Some products are invalid or don't belong to your store",
      });
    }

    // Create catalog
    const catalog = new catalogModel({
      name,
      store: store,
      owner: req.userId,
      description,
      products: productIds.map(id => ({ product: id })),
      isPublic: isPublic || false,
      useCustomDesign,
      theme,
      design
    });

    await catalog.save();

    // Generate share link and QR code
    const frontendUrl = process.env.FRONTEND_URL || req.body.frontendUrl || `${req.protocol}://${req.get('host')}`;
    const shareLink = `${frontendUrl}/catalog/public/${catalog._id}`;
    const qrCode = await qrcode.toDataURL(shareLink);

    // Update catalog with share link and QR code
    catalog.shareLink = shareLink;
    catalog.qrCode = qrCode;
    await catalog.save();

    logger.info(`Catalog created: ${name} by ${req.userId}`);
    logger.info(`shareLink: ${shareLink} qrCode: ${qrCode}`);
    res.json({
      success: true,
      message: "Catalog created successfully",
      data: catalog
    });
  } catch (error) {
    logger.error('Error creating catalog:', error);
    console.error('Detailed catalog creation error:', {
      message: error.message,
      stack: error.stack,
      productIds: req.body.productIds,
      userId: req.userId,
      frontendUrl: req.body.frontendUrl
    });
    res.status(500).json({ success: false, message: "Error creating catalog", error: error.message });
  }
};

// Get all catalogs of a user
const getCatalogs = async (req, res) => {
  try {
    // Verify user
    if (!req.userId) {
      return res.status(403).json({
        success: false,
        message: "Only the owners can access their catalogs",
      });
    }
    let query = {};
    if (req.userRole !== 'admin') query = { owner: req.userId }
    const catalogs = await catalogModel.find(query)
      .populate('products.product', 'name price image available store')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: catalogs });
  } catch (error) {
    logger.error('Error fetching catalogs:', error);
    res.status(500).json({ success: false, message: "Error fetching catalogs" });
  }
};
// Get all catalogs of a user by params
const getUserCatalogs = async (req, res) => {
  try {
    const { userId } = req.params;
    // Verify user
    if (!req.userId) {
      return res.status(403).json({
        success: false,
        message: "Only authenticated users can access user catalogs",
      });
    }
    const catalogs = await catalogModel.find({owner : userId})
      .populate('products.product', 'name price image available store')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: catalogs });
  } catch (error) {
    logger.error('Error fetching catalogs:', error);
    res.status(500).json({ success: false, message: "Error fetching catalogs" });
  }
};

// Get a specific catalog by ID
const getCatalog = async (req, res) => {
  try {
    const { catalogId } = req.params;
    const userId = req.userId;

    const catalog = await catalogModel.findById(catalogId)
      .populate('products.product', 'name price image available description')
      .populate('store', 'name username');

    if (!catalog) {
      return res.status(404).json({ success: false, message: "Catalog not found" });
    }

    // Check if user has access (store owner or public catalog)
    if (catalog.store._id.toString() !== userId && !catalog.isPublic) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.json({ success: true, data: catalog });
  } catch (error) {
    logger.error('Error fetching catalog:', error);
    res.status(500).json({ success: false, message: "Error fetching catalog" });
  }
};

// Update a catalog
const updateCatalog = async (req, res) => {
  try {
    const { catalogId } = req.params;
    const { name, description, productIds, isPublic, theme, design } = req.body;

    const catalog = await catalogModel.findById(catalogId);

    if (!catalog) {
      return res.status(404).json({ success: false, message: "Catalog not found" });
    }

    // Check if user is the store owner
    if (catalog.owner.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Verify products exist and belong to the store
    if (productIds) {
      const products = await productModel.find({
        _id: { $in: productIds },
        store: userId
      });

      if (products.length !== productIds.length) {
        return res.status(400).json({
          success: false,
          message: "Some products are invalid or don't belong to your store",
        });
      }

      catalog.products = productIds.map(id => ({ product: id }));
    }

    // Update fields
    if (name) catalog.name = name;
    if (description) catalog.description = description;
    if (isPublic !== undefined) catalog.isPublic = isPublic;
    if (theme) catalog.theme = theme;
    if (design) catalog.design = design;

    catalog.updatedAt = new Date();
    await catalog.save();

    logger.info(`Catalog updated: ${catalog.name}`);
    res.json({
      success: true,
      message: "Catalog updated successfully",
      data: catalog
    });
  } catch (error) {
    logger.error('Error updating catalog:', error);
    res.status(500).json({ success: false, message: "Error updating catalog" });
  }
};

// Delete a catalog
const deleteCatalog = async (req, res) => {
  try {
    const { catalogId } = req.params;

    const catalog = await catalogModel.findById(catalogId);

    if (!catalog) {
      return res.status(404).json({ success: false, message: "Catalog not found" });
    }

    // Check if user is the owner or admin
    if (catalog.owner.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    await catalogModel.findByIdAndDelete(catalogId);
    logger.info(`Catalog deleted: ${catalog.name}`);
    res.json({ success: true, message: "Catalog deleted successfully" });
  } catch (error) {
    logger.error('Error deleting catalog:', error);
    res.status(500).json({ success: false, message: "Error deleting catalog" });
  }
};

// Get public catalog (no authentication required)
const getPublicCatalog = async (req, res) => {
  try {
    const { catalogId } = req.params;

    const catalog = await catalogModel.findOne({
      _id: catalogId,
      isPublic: true
    }).populate('products.product', 'name price image store available description')
      .populate('owner', 'name username image avatar');

    if (!catalog) {
      return res.status(404).json({ success: false, message: "Catalog not found or not public" });
    }

    // If this is a guest user, ensure they have a guest user account
    if (!req.userId && req.guestSession) {
      try {
        const metadata = {
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          referrer: req.headers['referer'],
          deviceType: req.guestSession.metadata?.deviceType || 'unknown'
        };
        
        const guestResult = await guestUserService.getOrCreateGuestUser(req.guestSession.sessionId, metadata);
        logger.info(`Guest user associated with public catalog access: ${guestResult.user.username}`);
      } catch (guestError) {
        logger.error('Failed to associate guest user with catalog access:', guestError);
      }
    }

    res.json({ success: true, data: catalog });
  } catch (error) {
    logger.error('Error fetching public catalog:', error);
    res.status(500).json({ success: false, message: "Error fetching public catalog" });
  }
};

// Get all public catalogs of a store (no authentication required) with storeId
const getPublicUserCatalogs = async (req, res) => {
  try {
    const { owner } = req.params;

    const catalogs = await catalogModel.find({
      owner: owner,
      isPublic: true
    }).populate('products.product', 'name price image available')
      .populate('store', 'name username')
      .sort({ createdAt: -1 });

    // If this is a guest user, ensure they have a guest user account
    if (!req.userId && req.guestSession) {
      try {
        const metadata = {
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          referrer: req.headers['referer'],
          deviceType: req.guestSession.metadata?.deviceType || 'unknown'
        };
        
        const guestResult = await guestUserService.getOrCreateGuestUser(req.guestSession.sessionId, metadata);
        logger.info(`Guest user associated with public store catalogs access: ${guestResult.user.username}`);
      } catch (guestError) {
        logger.error('Failed to associate guest user with store catalogs access:', guestError);
      }
    }

    res.json({ success: true, data: catalogs });
  } catch (error) {
    logger.error('Error fetching public store catalogs:', error);
    res.status(500).json({ success: false, message: "Error fetching public store catalogs" });
  }
};

// Get all public catalogs (for public browsing)
const getPublicCatalogs = async (req, res) => {
  try {
    const catalogs = await catalogModel.find({ isPublic: true })
      .populate('owner', 'name username')
      .populate('products.product', 'name price image store');

    // If this is a guest user, ensure they have a guest user account
    if (!req.userId && req.guestSession) {
      try {
        const metadata = {
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          referrer: req.headers['referer'],
          deviceType: req.guestSession.metadata?.deviceType || 'unknown'
        };
        
        const guestResult = await guestUserService.getOrCreateGuestUser(req.guestSession.sessionId, metadata);
        logger.info(`Guest user associated with public catalogs browsing: ${guestResult.user.username}`);
      } catch (guestError) {
        logger.error('Failed to associate guest user with catalogs browsing:', guestError);
      }
    }

    res.json({ success: true, data: catalogs });
  } catch (error) {
    logger.error('Error fetching public catalogs:', error);
    res.status(500).json({ success: false, message: "Error fetching public catalogs" });
  }
};

// Duplicate a catalog with numbered name
const duplicateCatalog = async (req, res) => {
  try {
    const { catalogId } = req.params;

    const catalog = await catalogModel.findById(catalogId);

    if (!catalog) {
      return res.status(404).json({ success: false, message: "Catalog not found" });
    }

    // Check if user is the store owner
    if (!req.userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Create new catalog with same products (shared references)
    const duplicatedCatalog = new catalogModel({
      name: catalog.name + "(Copy)",
      store: catalog.store,
      owner: req.userId,
      description: catalog.description ? `${catalog.description} (Copy)` : undefined,
      products: catalog.products, // Share the same product references
      isPublic: catalog.isPublic,
      useCustomDesign: catalog.useCustomDesign,
      theme: catalog.theme,
      design: catalog.design
    });

    await duplicatedCatalog.save();

    // Generate share link and QR code
    const frontendUrl = process.env.FRONTEND_URL || req.body?.frontendUrl || `${req.protocol}://${req.get('host')}`;
    const shareLink = `${frontendUrl}/catalog/public/${duplicatedCatalog._id}`;
    const qrCode = await qrcode.toDataURL(shareLink);

    duplicatedCatalog.shareLink = shareLink;
    duplicatedCatalog.qrCode = qrCode;
    await duplicatedCatalog.save();

    logger.info(`Catalog duplicated: ${catalog.name} -> ${duplicatedCatalog.name} by ${req.userId}`);
    res.json({
      success: true,
      message: "Catalog duplicated successfully",
      data: duplicatedCatalog
    });
  } catch (error) {
    logger.error('Error duplicating catalog:', error);
    res.status(500).json({ success: false, message: "Error duplicating catalog" });
  }
};

// Get all catalog designs for a store
const getCatalogDesigns = async (req, res) => {
  try {
    const userId = req.userId;

    // Verify user is a store
    const user = await userModel.findById(userId);
    if (!user || user.role !== "store") {
      return res.status(403).json({
        success: false,
        message: "Only stores can access catalog designs",
      });
    }

    const designs = await catalogDesignModel.find({ store: userId })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: designs });
  } catch (error) {
    logger.error('Error fetching catalog designs:', error);
    res.status(500).json({ success: false, message: "Error fetching catalog designs" });
  }
};

// Create a new catalog design
const createCatalogDesign = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, description, layout, colorScheme, components } = req.body;

    // Verify user is a store
    const user = await userModel.findById(userId);
    if (!user || user.role !== "store") {
      return res.status(403).json({
        success: false,
        message: "Only stores can create catalog designs",
      });
    }

    const design = new catalogDesignModel({
      name,
      store: userId,
      description,
      layout,
      colorScheme,
      components
    });

    await design.save();

    logger.info(`Catalog design created: ${name} by ${user.username}`);
    res.json({
      success: true,
      message: "Catalog design created successfully",
      data: design
    });
  } catch (error) {
    logger.error('Error creating catalog design:', error);
    res.status(500).json({ success: false, message: "Error creating catalog design" });
  }
};

export {
  createCatalog,
  getUserCatalogs,
  getCatalog,
  getCatalogs,
  updateCatalog,
  deleteCatalog,
  getPublicCatalog,
  getPublicUserCatalogs,
  getPublicCatalogs,
  duplicateCatalog,
  getCatalogDesigns,
  createCatalogDesign
};
;