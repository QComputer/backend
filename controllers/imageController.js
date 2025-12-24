import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";
import { uploadImageToServer } from "../utils/imageUpload.js";
import userModel from "../models/userModel.js";
import imageModel from "../models/imageModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imageServerUrl = process.env.IMAGE_SERVER_URL || 'https://sefr-image.runflare.run';

if (!imageServerUrl) {
  throw new Error('IMAGE_SERVER_URL environment variable is required');
}

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

// Helper function to create a pre-restore backup
const createPreRestoreBackup = async () => {
  try {
    const response = await fetch(`${imageServerUrl}/backup`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to create pre-restore backup from image service');
    }

    const preRestoreDir = path.join(__dirname, '../uploads/pre-restore-backups');
    if (!fs.existsSync(preRestoreDir)) {
      fs.mkdirSync(preRestoreDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(preRestoreDir, `pre-restore-${timestamp}.zip`);

    const writer = fs.createWriteStream(backupPath);
    response.body.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(backupPath));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error creating pre-restore backup:', error);
    throw error;
  }
};

// Helper function to rollback a failed restore
const rollbackRestore = async (restoredFiles) => {
  try {
    // Find the most recent pre-restore backup
    const preRestoreDir = path.join(__dirname, '../uploads/pre-restore-backups');
    if (!fs.existsSync(preRestoreDir)) {
      throw new Error('No pre-restore backup directory found');
    }

    const files = fs.readdirSync(preRestoreDir)
      .filter(file => file.startsWith('pre-restore-') && file.endsWith('.zip'))
      .sort()
      .reverse(); // Most recent first

    if (files.length === 0) {
      throw new Error('No pre-restore backup found');
    }

    const latestPreRestore = files[0];
    const preRestorePath = path.join(preRestoreDir, latestPreRestore);

    // Clear current images and restore from pre-restore backup
    await clearImageService();

    // Restore from pre-restore backup
    const formData = new FormData();
    formData.append('backup', fs.createReadStream(preRestorePath), {
      filename: latestPreRestore,
      contentType: 'application/zip'
    });

    const response = await fetch(`${imageServerUrl}/restore`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to rollback using pre-restore backup');
    }

    // Clean up the pre-restore backup after successful rollback
    fs.unlinkSync(preRestorePath);

    console.log(`Successfully rolled back ${restoredFiles.length} files`);
  } catch (error) {
    console.error('Error during rollback:', error);
    throw error;
  }
};

// Helper function to clear all images from image service
const clearImageService = async () => {
  try {
    const response = await fetch(`${imageServerUrl}/clear`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to clear image service');
    }

    console.log('Image service cleared for rollback');
  } catch (error) {
    console.error('Error clearing image service:', error);
    throw error;
  }
};

// Download image backup from image service and save ZIP
export const downloadImageBackup = async (req, res) => {
  const startTime = Date.now();
  try {
    await checkAdmin(req.body.userId);
    const response = await fetch(`${imageServerUrl}/backup`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to download backup from image service');
    }

    const backupDir = path.join(__dirname, '../uploads/backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipPath = path.join(backupDir, `image-backup-${timestamp}.zip`);

    const writer = fs.createWriteStream(zipPath);
    response.body.pipe(writer);

    writer.on('finish', async () => {
      const duration = Date.now() - startTime;
      console.log(`✅ Backup download completed in ${duration}ms`);

      try {
        // Clean up old backups, keep only the 5 most recent
        await cleanupOldBackups(backupDir, 5);
      } catch (cleanupError) {
        console.warn('Failed to cleanup old backups:', cleanupError.message);
        // Don't fail the response for cleanup errors
      }

      res.json({
        success: true,
        message: 'Image backup downloaded and saved successfully',
        data: {
          path: zipPath,
          filename: `image-backup-${timestamp}.zip`,
          duration: `${duration}ms`
        }
      });
    });

    writer.on('error', (error) => {
      console.error('Error saving backup:', error);
      const errorResponse = createErrorResponse('Error saving backup file', 500, error);
      res.status(errorResponse.statusCode).json(errorResponse);
    });

  } catch (error) {
    console.error('Download backup error:', error);
    const errorResponse = createErrorResponse('Error downloading image backup', 500, error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
};

// Upload ZIP backup to image service for restore with transactional rollback
export const uploadBackupZip = async (req, res) => {
  let restoredFiles = [];
  let backupCreated = false;

  try {
    await checkAdmin(req.body.userId);
    // Find the latest backup zip in uploads/backups
    const backupDir = path.join(__dirname, '../uploads/backups');
    if (!fs.existsSync(backupDir)) {
      return res.status(404).json({
        success: false,
        message: 'No backup directory found'
      });
    }

    const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.zip')).sort();
    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No backup zip files found'
      });
    }

    const latestBackup = files[files.length - 1];
    const zipPath = path.join(backupDir, latestBackup);

    // Create a pre-restore backup for rollback purposes
    try {
      await createPreRestoreBackup();
      backupCreated = true;
    } catch (backupError) {
      console.warn('Failed to create pre-restore backup:', backupError.message);
      // Continue with restore even if pre-backup fails
    }

    // Upload the zip to image service restore endpoint
    const formData = new FormData();
    formData.append('backup', fs.createReadStream(zipPath), {
      filename: latestBackup,
      contentType: 'application/zip'
    });

    const response = await fetch(`${imageServerUrl}/restore`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload backup to image service: ${errorText}`);
    }

    const result = await response.json();

    // Track restored files for potential rollback
    if (result.data && result.data.extractedCount) {
      restoredFiles = result.data.restoredFiles || [];
    }

    res.json({
      success: true,
      message: 'Backup uploaded and restored successfully',
      data: {
        ...result.data,
        transactional: true,
        rollbackAvailable: backupCreated
      }
    });

  } catch (error) {
    console.error('Upload backup error:', error);

    // Attempt rollback if we have tracking information
    if (restoredFiles.length > 0) {
      try {
        console.log('Attempting rollback of failed restore...');
        await rollbackRestore(restoredFiles);
        console.log('Rollback completed successfully');
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error uploading backup - rollback attempted if applicable',
      error: error.message,
      rollbackAttempted: restoredFiles.length > 0
    });
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
      id: img._id
    }));

    res.json({
      success: true,
      data: imageData
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

// Delete image from image service with soft delete for owners, hard delete for admins
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
      // Admin: hard delete from both database and image service
      const response = await fetch(`${imageServerUrl}/images/${filename}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete image from image service');
      }

      // Remove from database
      await imageModel.findByIdAndDelete(image._id);

      const data = await response.json();
      res.json({
        success: true,
        message: 'Image permanently deleted',
        data
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

// Upload image to image service
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

    let imageUrl;
    try {
      imageUrl = await uploadImageToServer(req.file.buffer, req.file.originalname, req.file.mimetype);
    } catch (uploadError) {
      console.log('=== IMAGE SERVICE FALLBACK ===');
      console.log(`Image service unavailable (${uploadError.message}), using data URL fallback`);
      // Fallback: create data URL from buffer
      const base64 = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
      imageUrl = dataUrl;
      console.log(`Data URL created for image: ${dataUrl.substring(0, 50)}...`);
    }

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
      message: 'Image uploaded successfully',
      data: { url: imageUrl, id: imageDoc._id }
    });
  } catch (error) {
    console.error('Upload image error:', error);
    const errorResponse = createErrorResponse('Failed to upload image', 500, error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
};

// Clear all images from image service
export const clearImages = async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      throw new Error("Unauthorized admin request");
    }

    await clearImageService();

    res.json({
      success: true,
      message: 'All images cleared successfully'
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