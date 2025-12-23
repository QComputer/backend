import express from "express";
import {
  getCart,
  addToCart,
  updateCart,
  removeFromCart,
  // Guest cart functions
  migrateGuestCart,
} from "../controllers/cartController.js";
import { userCartMiddleware, unifiedAuth } from "../middleware/auth.js";

const cartRouter = express.Router();

// Unified cart routes (handle both authenticated users and guests)
// Now using unified authentication - all sessions are treated as authenticated
cartRouter.get("/", unifiedAuth, getCart);

cartRouter.post("/", unifiedAuth, addToCart);

cartRouter.delete("/:productId", unifiedAuth, removeFromCart);

cartRouter.put("/", unifiedAuth, updateCart);

// Cart migration route (now unified - works for all session types)
cartRouter.post("/migrate", userCartMiddleware, migrateGuestCart);

export default cartRouter;