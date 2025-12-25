import express from "express";
import {
  addCategory,
  listCategory,
  publicListCategory,
  removeCategory,
  editCategory,
} from "../controllers/categoryController.js";
import { authMiddleware } from "../middleware/auth.js";
import multer from "multer";

const categoryRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

categoryRouter.post("/add", authMiddleware({ requireAuth: true }), upload.single("image"), addCategory);
categoryRouter.post("/list", authMiddleware({ requireAuth: true }), listCategory);
categoryRouter.get("/public-list/:storeId", publicListCategory);
//categoryRouter.get("/:id", authMiddleware({ requireAuth: true }), getCategory);
categoryRouter.delete("/:id", authMiddleware({ requireAuth: true }), removeCategory);
categoryRouter.put("/:id", authMiddleware({ requireAuth: true }), upload.single("image"), editCategory);

export default categoryRouter;