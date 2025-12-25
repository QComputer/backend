import { checkDiskHealth, getDiskSpace, uploadImage } from "./controllers/imageController.js";
import fs from "fs/promises";
import path from "path";

// Mock request and response objects
const createMockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.responseData = data;
    return res;
  };
  return res;
};

// Test disk health endpoint
async function testDiskHealth() {
  console.log("🧪 Testing disk health endpoint...");
  
  const mockReq = {};
  const mockRes = createMockResponse();
  
  try {
    await checkDiskHealth(mockReq, mockRes);
    
    if (mockRes.responseData && mockRes.responseData.success) {
      console.log("✅ Disk health check successful:");
      console.log("   - Disk connected:", mockRes.responseData.data.diskConnected);
      console.log("   - Upload directory:", mockRes.responseData.data.uploadDirectory);
      if (mockRes.responseData.data.diskInfo) {
        console.log("   - Total space:", formatBytes(mockRes.responseData.data.diskInfo.totalSpace));
        console.log("   - Free space:", formatBytes(mockRes.responseData.data.diskInfo.freeSpace));
        console.log("   - Usage:", mockRes.responseData.data.diskInfo.usagePercentage.toFixed(2) + "%");
      }
      return true;
    } else {
      console.log("❌ Disk health check failed:", mockRes.responseData?.message || "Unknown error");
      return false;
    }
  } catch (error) {
    console.error("❌ Disk health test error:", error.message);
    return false;
  }
}

// Test disk space endpoint
async function testDiskSpace() {
  console.log("\n🧪 Testing disk space endpoint...");
  
  const mockReq = {};
  const mockRes = createMockResponse();
  
  try {
    await getDiskSpace(mockReq, mockRes);
    
    if (mockRes.responseData && mockRes.responseData.success) {
      console.log("✅ Disk space check successful:");
      console.log("   - Upload directory:", mockRes.responseData.data.uploadDirectory);
      console.log("   - Total space:", formatBytes(mockRes.responseData.data.diskStats.totalSpace));
      console.log("   - Free space:", formatBytes(mockRes.responseData.data.diskStats.freeSpace));
      console.log("   - Used space:", formatBytes(mockRes.responseData.data.diskStats.usedSpace));
      console.log("   - Usage:", mockRes.responseData.data.diskStats.usagePercentage.toFixed(2) + "%");
      console.log("   - File count:", mockRes.responseData.data.fileCount);
      console.log("   - Total file size:", formatBytes(mockRes.responseData.data.totalFileSize));
      return true;
    } else {
      console.log("❌ Disk space check failed:", mockRes.responseData?.message || "Unknown error");
      return false;
    }
  } catch (error) {
    console.error("❌ Disk space test error:", error.message);
    return false;
  }
}

// Test image upload endpoint
async function testImageUpload() {
  console.log("\n🧪 Testing image upload endpoint...");
  
  // Read the test image file
  const testImagePath = path.join(process.cwd(), "test-image.png");
  
  try {
    const imageBuffer = await fs.readFile(testImagePath);
    
    // Create mock request with file data
    const mockReq = {
      file: {
        buffer: imageBuffer,
        originalname: "test-image.png",
        mimetype: "image/png"
      },
      userId: "60d5ec9f8b3a8b001f8b4567", // Valid ObjectId format
      body: {
        description: "Test image upload",
        tags: ["test", "upload"] // Array of strings as expected by the model
      }
    };
    
    const mockRes = createMockResponse();
    
    // Call the upload function
    await uploadImage(mockReq, mockRes);
    
    if (mockRes.responseData && mockRes.responseData.success) {
      console.log("✅ Image upload successful:");
      console.log("   - Image URL:", mockRes.responseData.data.url);
      console.log("   - Image ID:", mockRes.responseData.data.id);
      console.log("   - Message:", mockRes.responseData.message);
      
      // Verify the file was actually saved
      const filename = mockRes.responseData.data.url.split('/').pop();
      const uploadDir = process.env.LIARA_DISK_PATH
        ? path.join(process.env.LIARA_DISK_PATH, 'uploads')
        : path.join(process.cwd(), 'uploads');
      
      const savedFilePath = path.join(uploadDir, filename);
      
      try {
        await fs.access(savedFilePath);
        console.log("   - File saved to:", savedFilePath);
        
        const fileStats = await fs.stat(savedFilePath);
        console.log("   - File size:", formatBytes(fileStats.size));
        return true;
      } catch (error) {
        console.warn("   ⚠️  File not found on disk:", savedFilePath);
        return false;
      }
    } else {
      console.log("❌ Image upload failed:", mockRes.responseData?.message || "Unknown error");
      if (mockRes.responseData?.error) {
        console.log("   Error details:", mockRes.responseData.error);
      }
      return false;
    }
  } catch (error) {
    console.error("❌ Image upload test error:", error.message);
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

// Run all tests
async function runAllTests() {
  console.log("🚀 Starting comprehensive endpoint tests...\n");
  
  const healthSuccess = await testDiskHealth();
  const spaceSuccess = await testDiskSpace();
  const uploadSuccess = await testImageUpload();
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST RESULTS:");
  console.log("   - Disk Health Endpoint:", healthSuccess ? "✅ PASSED" : "❌ FAILED");
  console.log("   - Disk Space Endpoint:", spaceSuccess ? "✅ PASSED" : "❌ FAILED");
  console.log("   - Image Upload Endpoint:", uploadSuccess ? "✅ PASSED" : "❌ FAILED");
  
  const allPassed = healthSuccess && spaceSuccess && uploadSuccess;
  
  if (allPassed) {
    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("\n📋 SUMMARY:");
    console.log("   ✅ Disk connection and health endpoints are working");
    console.log("   ✅ Disk space and usage endpoints are working");
    console.log("   ✅ Image upload functionality is working");
    console.log("   ✅ Files are being saved to disk correctly");
    console.log("\n🔧 NEW ENDPOINTS ADDED:");
    console.log("   - GET /api/v1/image/disk/health - Check disk connection and health");
    console.log("   - GET /api/v1/image/disk/space - Get detailed disk space information");
    process.exit(0);
  } else {
    console.log("\n❌ SOME TESTS FAILED!");
    process.exit(1);
  }
}

runAllTests();