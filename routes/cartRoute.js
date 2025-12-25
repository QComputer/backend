import express from "express";
import {
  getCart,
  addToCart,
  updateCart,
  removeFromCart,
  // Guest cart functions
  migrateGuestCart,
} from "../controllers/cartController.js";
import { userOrGuest, userCartMiddleware } from "../middleware/auth.js";
import { autoGuestLogin } from "../middleware/autoGuestLogin.js";

const cartRouter = express.Router();

// Public cart routes (allow unauthenticated users with auto guest login)
cartRouter.get("/", userOrGuest, autoGuestLogin, getCart);

cartRouter.post("/", userOrGuest, addToCart);

// Protected cart routes (require authentication for modifications)
cartRouter.delete("/:productId", userOrGuest, removeFromCart);

cartRouter.put("/", userOrGuest, updateCart);

// Cart migration route (now unified - works for all session types)
cartRouter.post("/migrate", userCartMiddleware, migrateGuestCart);

export default cartRouter;