import express from "express";
import {
  addCategory,
  listCategory,
  publicListCategory,
  removeCategory,
  editCategory,
} from "../controllers/categoryController.js";
import { unifiedAuth } from "../middleware/auth.js";
import multer from "multer";

const categoryRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

categoryRouter.post("/add", unifiedAuth, upload.single("image"), addCategory);
categoryRouter.post("/list", unifiedAuth, listCategory);
categoryRouter.get("/public-list/:storeId", publicListCategory);
//categoryRouter.get("/:id", unifiedAuth, getCategory);
categoryRouter.delete("/:id", unifiedAuth, removeCategory);
categoryRouter.put("/:id", unifiedAuth, upload.single("image"), editCategory);

export default categoryRouter;