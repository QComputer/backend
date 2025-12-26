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
import {authMiddleware, adminOnly, userOrGuest, storeOnly } from "../middleware/auth.js";
import { autoGuestLogin } from "../middleware/autoGuestLogin.js";
import multer from "multer";

const productRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Protected routes (authentication required)
productRouter.get("/all", adminOnly, getAllProducts); // admin only
productRouter.get("/list", authMiddleware, getProductsWithCategories); // owner store
productRouter.get("/products-with-categories", userOrGuest, getProductsWithCategories); // Get products and categories combined (optimized for products page)
//productRouter.post("/cart-products", authMiddleware, getCartProducts);
productRouter.post("/add", authMiddleware, upload.single("image"), addProduct);
productRouter.get("/store/:username", userOrGuest, publicListProduct);
productRouter.get("/:id", authMiddleware, getProduct);
productRouter.delete("/:id", authMiddleware, removeProduct);
productRouter.put("/:id", authMiddleware, upload.single("image"), editProduct);

// Reaction routes
productRouter.post("/reaction", userOrGuest, addProductReaction);
productRouter.delete("/reaction", adminOnly, removeProductReaction);
productRouter.get("/reaction/:userId/:productId", userOrGuest, getProductReaction);

// Public routes (no authentication required)
productRouter.get("/public-list/:storeId", userOrGuest, autoGuestLogin, getPublicProducts); // Get all public products with filtering
productRouter.get("/public/:productId", userOrGuest, autoGuestLogin, getPublicProduct); // Get single public product
//productRouter.get("/public-catalog/:catalogId", userOrGuest, autoGuestLogin, getPublicProductsByCatalog); // Get products for public catalog

export default productRouter;