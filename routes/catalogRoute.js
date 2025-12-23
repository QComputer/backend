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
import { unifiedAuth } from "../middleware/auth.js";
import { autoGuestLogin } from "../middleware/autoGuestLogin.js";

const catalogRouter = express.Router();

// Protected routes (authentication required)
catalogRouter.post("/create", unifiedAuth, createCatalog);
catalogRouter.post("/duplicate/:catalogId", unifiedAuth, duplicateCatalog);
catalogRouter.get("/list", unifiedAuth, getCatalogs);
catalogRouter.get("/designs", unifiedAuth, getCatalogDesigns);
catalogRouter.post("/design", unifiedAuth, createCatalogDesign);

// Public routes (no authentication required)
catalogRouter.get("/public-list", autoGuestLogin, getPublicCatalogs);
catalogRouter.get("/public/:catalogId", autoGuestLogin, getPublicCatalog);
catalogRouter.get("/public/list/:userId", autoGuestLogin, getPublicUserCatalogs);

// Parameterized routes (must come last)
catalogRouter.get("/:catalogId", unifiedAuth, getCatalog);
catalogRouter.put("/:catalogId", unifiedAuth, updateCatalog);
catalogRouter.delete("/:catalogId", unifiedAuth, deleteCatalog);
catalogRouter.get("/user/:userId", unifiedAuth, getUserCatalogs);

export default catalogRouter;