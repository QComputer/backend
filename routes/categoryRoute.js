import express from "express";
import {
  addCategory,
  listCategory,
  publicListCategory,
  removeCategory,
  editCategory,
} from "../controllers/categoryController.js";
import { authMiddleware,userOrGuest } from "../middleware/auth.js";
import multer from "multer";

const categoryRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

categoryRouter.post("/add", userOrGuest, upload.single("image"), addCategory);
categoryRouter.post("/list", userOrGuest, listCategory);
categoryRouter.get("/public-list/:storeId", publicListCategory);
//categoryRouter.get("/:id", getCategory);
categoryRouter.delete("/:id", authMiddleware, removeCategory);
categoryRouter.put("/:id", upload.single("image"), editCategory);

export default categoryRouter;