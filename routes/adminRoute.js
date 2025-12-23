import express from "express";
import {adminOnly} from "../middleware/auth.js";
import {
  // Template management
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplateStatus,
  // Theme management
  getAllThemes,
  createTheme,
  updateTheme,
  deleteTheme,
  toggleThemeStatus,
  setDefaultTheme,
  getDefaultTheme,
  //applyThemeToCatalog
} from "../controllers/adminController.js";

const adminRouter = express.Router();

// Template Management Routes
adminRouter.get("/templates", adminOnly, getAllTemplates);
adminRouter.post("/templates", adminOnly, createTemplate);
adminRouter.put("/templates/:id", adminOnly, updateTemplate);
adminRouter.delete("/templates/:id", adminOnly, deleteTemplate);
adminRouter.patch("/templates/:id/toggle", adminOnly, toggleTemplateStatus);

// Theme Management Routes

adminRouter.get("/themes", adminOnly, getAllThemes);
adminRouter.post("/themes", adminOnly, createTheme);
adminRouter.put("/themes/:id", adminOnly, updateTheme);
adminRouter.delete("/themes/:id", adminOnly, deleteTheme);
adminRouter.patch("/themes/:id/toggle", adminOnly, toggleThemeStatus);
adminRouter.patch("/themes/:id/default", adminOnly, setDefaultTheme);
adminRouter.get("/themes/default", adminOnly, getDefaultTheme);

// Apply theme to catalog
//adminRouter.post("/apply-theme/catalog/:catalogId/theme/:themeId", applyThemeToCatalog);

export default adminRouter;