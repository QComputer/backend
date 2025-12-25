import express from "express";
import {
  downloadImageBackup,
  uploadBackupZip,
  listImages,
  deleteImage,
  uploadImage,
  clearImages,
} from "../controllers/imageController.js";
import {adminOnly, authMiddleware} from "../middleware/auth.js";
import multer from "multer";
;
const imageRouter = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Download image backup from image service (admin only)
imageRouter.get("/backup", adminOnly, downloadImageBackup);

// Upload backup zip to image service for restore (admin only)
imageRouter.post("/restore", adminOnly, uploadBackupZip);

// List all images from image service (admin only)
imageRouter.get("/list", adminOnly, listImages);

// Delete image from image service (admin users)
imageRouter.delete("/images/:filename", adminOnly, deleteImage);

// Clear all images from image service (admin only)
imageRouter.delete("/clear", adminOnly, clearImages);

// Upload image to image service (all authenticated users)
imageRouter.post("/upload", authMiddleware, upload.single("image"), uploadImage);

export default imageRouter;