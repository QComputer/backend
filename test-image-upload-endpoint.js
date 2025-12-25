import { uploadImage } from "./controllers/imageController.js";
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

// Test image upload endpoint
async function testImageUpload() {
  console.log("🧪 Testing image upload endpoint...");
  
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

// Run test
async function runTest() {
  console.log("🚀 Starting image upload endpoint test...\n");
  
  const success = await testImageUpload();
  
  console.log("\n" + "=".repeat(50));
  if (success) {
    console.log("🎉 Image upload endpoint test passed!");
    process.exit(0);
  } else {
    console.log("❌ Image upload endpoint test failed!");
    process.exit(1);
  }
}

runTest();