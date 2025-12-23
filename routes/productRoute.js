import express from "express";
import {
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
  //getPublicProductsByCatalog,
  // Reaction functions
  addProductReaction,
  removeProductReaction,
  getProductReaction,
} from "../controllers/productController.js";
import {adminOnly, unifiedAuth } from "../middleware/auth.js";

const productRouter = express.Router();

// Public routes (no authentication required)
productRouter.get("/public-list/:storeId", getPublicProducts); // Get all public products with filtering
productRouter.get("/public/:productId", getPublicProduct); // Get single public product
//productRouter.get("/public-catalog/:catalogId", getPublicProductsByCatalog); // Get products for public catalog


// Protected routes (authentication required)
productRouter.get("/all", unifiedAuth, adminOnly, getAllProducts); // admin only
productRouter.get("/list",unifiedAuth, listProduct); // owner store
productRouter.get("/products-with-categories", unifiedAuth, getProductsWithCategories); // Get products and categories combined
productRouter.post("/cart-products", unifiedAuth, getCartProducts);
productRouter.post("/add", unifiedAuth, addProduct);
productRouter.get("/store/:username", unifiedAuth, publicListProduct);
productRouter.get("/:id", unifiedAuth, getProduct);
productRouter.delete("/:id", unifiedAuth, removeProduct);
productRouter.put("/:id", unifiedAuth, editProduct);

// Reaction routes
productRouter.post("/reaction", unifiedAuth, addProductReaction);
productRouter.delete("/reaction", unifiedAuth, removeProductReaction);
productRouter.get("/reaction/:userId/:productId", unifiedAuth, getProductReaction);

export default productRouter;