import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { uploadImageToServer } from "../utils/imageUpload.js";
import userModel from "../models/userModel.js";
import imageModel from "../models/imageModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standardized error response helpers
const createErrorResponse = (message, statusCode = 500, error = null) => ({
  success: false,
  message,
  error: error?.message || error,
  timestamp: new Date().toISOString(),
  statusCode
});

const createSuccessResponse = (data, message = 'Success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString()
});

// Enhanced image validation - check file signature (magic bytes)
const validateImageContent = (buffer) => {
  // Check for common image file signatures
  const signatures = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]],
    'image/bmp': [[0x42, 0x4D]],
    'image/tiff': [[0x49, 0x49, 0x2A, 0x00], [0x4D, 0x4D, 0x00, 0x2A]]
  };

  for (const [mimeType, sigs] of Object.entries(signatures)) {
    for (const sig of sigs) {
      let match = true;
      for (let i = 0; i < sig.length; i++) {
        if (sig[i] !== null && buffer[i] !== sig[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return mimeType;
      }
    }
  }

  return null; // Not a valid image
};

// Helper function to check if user is admin
const checkAdmin = async (userId) => {
  if (!userId) {
    throw new Error("Unauthorized user request");
  }

  const user = await userModel.findById(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized admin request");
  }

  return user;
};

// Helper function to cleanup old backup files
const cleanupOldBackups = async (backupDir, keepCount = 5) => {
  try {
    if (!fs.existsSync(backupDir)) {
      return;
    }

    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.zip'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          mtime: stats.mtime
        };
      })
      .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first

    if (files.length <= keepCount) {
      return; // No cleanup needed
    }

    // Delete old files beyond the keep count
    const filesToDelete = files.slice(keepCount);
    let deletedCount = 0;

    for (const file of filesToDelete) {
      try {
        fs.unlinkSync(file.path);
        deletedCount++;
        console.log(`Cleaned up old backup: ${file.name}`);
      } catch (error) {
        console.warn(`Failed to delete old backup ${file.name}:`, error.message);
      }
    }

    console.log(`Backup cleanup completed: kept ${keepCount} recent backups, deleted ${deletedCount} old backups`);
  } catch (error) {
    console.error('Error during backup cleanup:', error);
    throw error;
  }
};

// Download image backup from Liara disk
export const downloadImageBackup = async (req, res) => {
  try {
    await checkAdmin(req.body.userId);
    
    const backupDir = path.join(__dirname, '../uploads/backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Create a simple backup by copying all files to a backup directory
    const uploadFiles = fs.readdirSync(UPLOAD_DIR);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSubDir = path.join(backupDir, `liara-disk-backup-${timestamp}`);
    
    if (!fs.existsSync(backupSubDir)) {
      fs.mkdirSync(backupSubDir, { recursive: true });
    }

    let copiedCount = 0;
    for (const file of uploadFiles) {
      const sourcePath = path.join(UPLOAD_DIR, file);
      const destPath = path.join(backupSubDir, file);
      
      if (fs.statSync(sourcePath).isFile()) {
        fs.copyFileSync(sourcePath, destPath);
        copiedCount++;
      }
    }

    res.json({
      success: true,
      message: 'Liara disk backup created successfully',
      data: {
        path: backupSubDir,
        folderName: `liara-disk-backup-${timestamp}`,
        fileCount: copiedCount
      }
    });
  } catch (error) {
    console.error('Backup error:', error);
    const errorResponse = createErrorResponse('Error creating Liara disk backup', 500, error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
};

// Upload backup to Liara disk for restore
export const uploadBackupZip = async (req, res) => {
  try {
    await checkAdmin(req.body.userId);
    
    if (!req.file) {
      const errorResponse = createErrorResponse("No backup file uploaded", 400);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // For simplicity, we'll just save the uploaded file as a backup
    // In a real implementation, you would extract the zip contents
    const backupDir = path.join(__dirname, '../uploads/backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `restore-backup-${timestamp}.zip`);
    
    await fs.promises.writeFile(backupPath, req.file.buffer);

    res.json({
      success: true,
      message: 'Backup file uploaded successfully. Manual extraction to uploads directory required.',
      data: {
        backupPath,
        filename: `restore-backup-${timestamp}.zip`,
        note: 'Extract this file to the uploads directory to restore images'
      }
    });
  } catch (error) {
    console.error('Restore error:', error);
    const errorResponse = createErrorResponse('Error uploading backup file', 500, error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
};

// List all images from database with soft delete filtering
export const listImages = async (req, res) => {
  try {
    if (req.useRole !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const images = await imageModel
      .find({})
      .populate('uploadedBy', 'username name')
      .sort({ createdAt: -1 });

    // Transform to match expected format
    const imageData = images.map(img => ({
      filename: img.url.split('/').pop() || img._id.toString(),
      url: img.url,
      size: 0, // Size not tracked in our model
      uploadDate: img.createdAt.toISOString(),
      uploadedBy: img.uploadedBy,
      deleted: img.deleted,
      id: img._id,
      storage: 'liara-disk' // Indicate storage method
    }));

    res.json({
      success: true,
      data: imageData,
      storageInfo: {
        type: 'liara-disk',
        path: UPLOAD_DIR
      }
    });
  } catch (error) {
    console.error('List images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing images',
      error: error.message
    });
  }
};

// Delete image from Liara disk with soft delete for owners, hard delete for admins
export const deleteImage = async (req, res) => {
  try {
    const { filename } = req.params;
    const userId = req.body.userId || req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Find the image in our database
    const image = await imageModel.findOne({ url: { $regex: filename } });
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found in database'
      });
    }

    // Check user role
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const isAdmin = user.role === 'admin';
    const isOwner = image.uploadedBy.toString() === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this image'
      });
    }

    if (isAdmin) {
      // Admin: hard delete from both database and Liara disk
      try {
        const filePath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted file from Liara disk: ${filename}`);
        }
      } catch (deleteError) {
        console.warn(`Failed to delete file from Liara disk: ${deleteError.message}`);
        // Continue with database deletion even if file deletion fails
      }

      // Remove from database
      await imageModel.findByIdAndDelete(image._id);

      res.json({
        success: true,
        message: 'Image permanently deleted from Liara disk and database',
        data: { filename, deletedFromDisk: true }
      });
    } else {
      // Owner (non-admin): soft delete
      image.deleted = true;
      image.deletedAt = new Date();
      image.deletedBy = userId;
      await image.save();

      res.json({
        success: true,
        message: 'Image marked as deleted (soft delete)',
        data: { softDeleted: true }
      });
    }
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting image',
      error: error.message
    });
  }
};

// Upload image to Liara disk
export const uploadImage = async (req, res) => {
  console.log(`📤 Image upload request received: ${req.method} ${req.originalUrl || req.path}`);

  try {
    if (!req.file) {
      const errorResponse = createErrorResponse("No file uploaded", 400);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Enhanced image validation
    const detectedMimeType = validateImageContent(req.file.buffer);
    if (!detectedMimeType) {
      const errorResponse = createErrorResponse("Invalid image file - file signature does not match image format", 400);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Verify mimetype matches detected type
    if (req.file.mimetype !== detectedMimeType) {
      console.warn(`Mimetype mismatch: claimed ${req.file.mimetype}, detected ${detectedMimeType}`);
    }

    // Upload to Liara disk (primary storage method)
    const imageUrl = await uploadImageToServer(req.file.buffer, req.file.originalname, req.file.mimetype);

    // Save image metadata to database
    const imageDoc = new imageModel({
      url: imageUrl,
      altText: req.file.originalname || 'Uploaded image',
      description: req.description || '',
      tags: [req.tags] || [],
      uploadedBy: req.userId
    });

    await imageDoc.save();

    res.json({
      success: true,
      message: 'Image uploaded successfully to Liara disk',
      data: { url: imageUrl, id: imageDoc._id }
    });
  } catch (error) {
    console.error('Upload image error:', error);
    const errorResponse = createErrorResponse('Failed to upload image to Liara disk', 500, error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
};

// Clear all images from Liara disk
export const clearImages = async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      throw new Error("Unauthorized admin request");
    }

    // Clear all images from Liara disk
    try {
      const files = fs.readdirSync(UPLOAD_DIR);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(UPLOAD_DIR, file);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`Deleted file: ${file}`);
        } catch (error) {
          console.warn(`Failed to delete file ${file}: ${error.message}`);
        }
      }
      
      console.log(`Cleared ${deletedCount} files from Liara disk`);
    } catch (error) {
      console.error('Error clearing Liara disk:', error);
      throw new Error('Failed to clear Liara disk');
    }

    // Clear all images from database
    await imageModel.deleteMany({});

    res.json({
      success: true,
      message: 'All images cleared successfully from Liara disk and database'
    });
  } catch (error) {
    console.error('Clear images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing images',
      error: error.message
    });
  }
};