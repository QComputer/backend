import express from "express";
import {
  createCatalog,
  getCatalogs,
  getCatalog,
  getUserCatalogs,
  updateCatalog,
  deleteCatalog,
  getPublicCatalog,
  getPublicUserCatalogs,
  getPublicCatalogs,
  duplicateCatalog,
  getCatalogDesigns,
  createCatalogDesign
} from "../controllers/catalogController.js";
import { authMiddleware, adminOnly, staffOnly,  userOrGuest } from "../middleware/auth.js";
import { autoGuestLogin } from "../middleware/autoGuestLogin.js";

const catalogRouter = express.Router();

// Protected routes 
catalogRouter.post("/create", staffOnly, createCatalog);
catalogRouter.post("/duplicate/:catalogId", authMiddleware, duplicateCatalog);
catalogRouter.get("/list", authMiddleware, getCatalogs);
catalogRouter.get("/designs", staffOnly, getCatalogDesigns);
catalogRouter.post("/design", adminOnly, createCatalogDesign);

// Public routes  (guest alloewd)
catalogRouter.get("/public-list", userOrGuest, getPublicCatalogs);
catalogRouter.get("/public/:catalogId", userOrGuest, autoGuestLogin, getPublicCatalog); // unauthenticated users allowed
catalogRouter.get("/public/list/:userId", userOrGuest, getPublicUserCatalogs);

// Parameterized routes (must come last)
catalogRouter.get("/:catalogId", staffOnly, getCatalog);
catalogRouter.put("/:catalogId", staffOnly, updateCatalog);
catalogRouter.delete("/:catalogId", staffOnly, deleteCatalog);
catalogRouter.get("/user/:userId", staffOnly, getUserCatalogs);

export default catalogRouter;