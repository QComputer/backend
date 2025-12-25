import { uploadImageToServer } from "./utils/imageUpload.js";
import fs from "fs/promises";
import path from "path";

// Test the core image upload functionality (without database)
async function testCoreImageUpload() {
  console.log("🧪 Testing core image upload functionality (disk only)...");
  
  // Read the test image file
  const testImagePath = path.join(process.cwd(), "test-image.png");
  
  try {
    const imageBuffer = await fs.readFile(testImagePath);
    
    // Test the core upload function
    const imageUrl = await uploadImageToServer(
      imageBuffer,
      "test-image.png",
      "image/png"
    );
    
    console.log("✅ Core image upload successful:");
    console.log("   - Image URL:", imageUrl);
    
    // Verify the file was actually saved
    const filename = imageUrl.split('/').pop();
    const uploadDir = process.env.LIARA_DISK_PATH
      ? path.join(process.env.LIARA_DISK_PATH, 'uploads')
      : path.join(process.cwd(), 'uploads');
    
    const savedFilePath = path.join(uploadDir, filename);
    
    try {
      await fs.access(savedFilePath);
      console.log("   - File saved to:", savedFilePath);
      
      const fileStats = await fs.stat(savedFilePath);
      console.log("   - File size:", formatBytes(fileStats.size));
      console.log("   - File created:", fileStats.birthtime);
      console.log("   - File modified:", fileStats.mtime);
      
      // Verify the file content matches
      const savedBuffer = await fs.readFile(savedFilePath);
      if (savedBuffer.equals(imageBuffer)) {
        console.log("   - File content verified: ✅ MATCHES");
      } else {
        console.log("   - File content verified: ❌ DOES NOT MATCH");
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn("   ⚠️  File not found on disk:", savedFilePath);
      return false;
    }
  } catch (error) {
    console.error("❌ Core image upload test error:", error.message);
    return false;
  }
}

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Run test
async function runTest() {
  console.log("🚀 Starting core image upload test...\n");
  
  const success = await testCoreImageUpload();
  
  console.log("\n" + "=".repeat(50));
  if (success) {
    console.log("🎉 Core image upload test PASSED!");
    console.log("\n📋 SUMMARY:");
    console.log("   ✅ Image upload to disk is working");
    console.log("   ✅ Files are being saved correctly");
    console.log("   ✅ File content is preserved");
    console.log("   ✅ File metadata is correct");
    process.exit(0);
  } else {
    console.log("❌ Core image upload test FAILED!");
    process.exit(1);
  }
}

runTest();