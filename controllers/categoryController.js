import categoryModel from "../models/categoryModel.js";
import winston from "winston";

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

// Add category
const addCategory = async (req, res) => {
  try {
    const { name, description, image, isGlobal } = req.body;
    // Handle case where image might be an empty object from FormData parsing
    const processedImage = (image && typeof image === 'object' && Object.keys(image).length === 0) ? undefined : image;
    const userId = req.userId;
    const userRole = req.userRole;

    if (!userId || (userRole !== "store" && userRole !== "admin")) {
      return res.status(403).json({
        success: false,
        message: "Only stores and admins can add categories",
      });
    }

    // Validate isGlobal flag based on user role
    let categoryIsGlobal = false;
    if (isGlobal !== undefined) {
      // Convert string to boolean properly
      const isGlobalBool = isGlobal === 'true' || isGlobal === true;

      if (userRole === "admin") {
        // Admins can set isGlobal to true or false
        categoryIsGlobal = isGlobalBool;

      } else {
        // users can only create non-global categories
        if (isGlobalBool) {
          return res.status(403).json({
            success: false,
            message: "Stores cannot create global categories. Only admins can create global categories.",
          });
        }
        categoryIsGlobal = false;
      }
    }

    const category = new categoryModel({
      name,
      store: userId,
      description,
      image: (typeof processedImage === 'string' && processedImage.trim()) ? processedImage : undefined,
      isGlobal: categoryIsGlobal,
    });

    await category.save();
    logger.info(`Category added: ${name} by ${userId} (isGlobal: ${categoryIsGlobal})`);
    res.json({
      success: true,
      message: "Category Added",
      data: {
        _id: category._id,
        name: category.name,
        isGlobal: category.isGlobal,
        store: category.store
      }
    });
  } catch (error) {
    logger.error('Error adding category:', error);
    res.json({ success: false, message: "Error" });
  }
};

// List categories for marketer or admin
const listCategory = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    let query = {};
    if (userRole === 'admin') {
      // Admins can see all categories
      query = {};
    } else if (userRole === 'store') {
      // Stores see their own categories and global categories
      query = { $or: [{ store: userId }, { isGlobal: true }] };
    } else {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const categories = await categoryModel.find(query).populate('store', 'username name');
    res.json({ success: true, data: categories });
  } catch (error) {
    logger.error('Error listing categories:', error);
    res.json({ success: false, message: "Error" });
  }
};

// Public list categories (no authentication required)
const publicListCategory = async (req, res) => {
  try {
    const storeId = req.params.storeId;
    let query = { }
    // For public access, show all categories (categories are not sensitive information)
    if (storeId) {
      query = { $or: [{ store: storeId }, { isGlobal: true }] };
    }
    
    const categories = await categoryModel.find(query).populate('store', 'username name');
    
    // Filter out categories that have no products
    if (storeId) {
      const productModel = await import('../models/productModel.js').then(m => m.default);
      const categoriesWithProducts = await Promise.all(
        categories.map(async (category) => {
          // Check if category has any products (either in category or categoryGlobal field)
          const hasProducts = await productModel.countDocuments({
            $or: [
              { category: category._id },
              { categoryGlobal: category._id }
            ],
            available: true
          }).exec();
          
          return hasProducts > 0 ? category : null;
        })
      );
      
      // Remove null entries (categories with no products)
      const filteredCategories = categoriesWithProducts.filter(c => c !== null);
      res.json({ success: true, data: filteredCategories });
    } else {
      res.json({ success: true, data: categories });
    }
  } catch (error) {
    logger.error('Error listing public categories:', error);
    res.json({ success: false, message: "Error fetching categories" });
  }
};

// Remove category
const removeCategory = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const categoryId = req.params.id;

    const category = await categoryModel.findById(categoryId);

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Check permissions: stores can only delete their own categories (not global ones), admins can delete any
    if (userRole !== 'admin') {
      if (category.store.toString() !== userId) {
        return res.status(403).json({ success: false, message: "You can only delete your own categories" });
      }
      if (category.isGlobal) {
        return res.status(403).json({ success: false, message: "Stores cannot delete global categories" });
      }
    }

    await categoryModel.findByIdAndDelete(categoryId);
    logger.info(`Category removed: ${category.name} by user ${userId}`);
    res.json({ success: true, message: "Category Removed" });
  } catch (error) {
    logger.error('Error removing category:', error);
    res.json({ success: false, message: "Error" });
  }
};

// Edit category
const editCategory = async (req, res) => {
  try {
    const { name, description, image, isGlobal } = req.body;
    const id = req.params.id;
    // Handle case where image might be an empty object from FormData parsing
    const processedImage = (image && typeof image === 'object' && Object.keys(image).length === 0) ? undefined : image;
    const userId = req.userId;
    const userRole = req.userRole;

    const category = await categoryModel.findById(id);

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Check permissions: stores can only edit their own categories (not global ones), admins can edit any
    if (userRole == 'admin') {
      if (isGlobal !== undefined) {
        // Convert string to boolean properly
        category.isGlobal = isGlobal === 'true' || isGlobal === true;
      }
    } else {
      if (category.store.toString() !== req.userId.toString()) {
        return res.status(403).json({ success: false, message: "You can only edit your own categories."});
      } else if (category.isGlobal) {
        return res.status(403).json({ success: false, message: "Stores cannot edit global categories." });
      }
    }

    // Handle image upload if a new image file is provided
    let imageUrl = (typeof processedImage === 'string' && processedImage.trim()) ? processedImage : category.image; // Use existing image if no valid new one provided
    if (req.file) {
      try {
        // Import the upload function from image controller
        const { uploadImageToServer } = await import('./imageController.js');
        imageUrl = await uploadImageToServer(req.file.buffer, req.file.originalname, req.file.mimetype);
      } catch (uploadError) {
        console.log('=== IMAGE SERVICE FALLBACK ===');
        console.log(`Image service unavailable (${uploadError.message}), using data URL fallback`);
        // Fallback: create data URL from buffer
        const base64 = req.file.buffer.toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
        imageUrl = dataUrl;
        console.log(`Data URL created for category image: ${dataUrl.substring(0, 50)}...`);
      }
    }

    if (name) category.name = name;
    if (description) category.description = description;
    if (typeof imageUrl === 'string' && imageUrl.trim()) category.image = imageUrl;

    category.updatedAt = new Date();
    const updatedCategory = await category.save();

    logger.info(`Category updated: ${category.name} by ${userId}`);
    res.json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    logger.error('Error updating category:', error);
    res.status(500).json({ success: false, message: "Error updating category" });
  }
};

export {
  addCategory,
  listCategory,
  publicListCategory,
  removeCategory,
  editCategory,
};