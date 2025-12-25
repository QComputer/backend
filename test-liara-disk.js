import { uploadImageToServer } from "./utils/imageUpload.js";
import fs from "fs/promises";
import path from "path";

// Test the Liara disk upload functionality
async function testLiaraDiskUpload() {
  try {
    console.log("🧪 Testing Liara disk upload functionality...");
    
    // Create a test image buffer
    const testImageBuffer = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    
    // Test upload
    const imageUrl = await uploadImageToServer(
      testImageBuffer,
      "test-image.png",
      "image/png"
    );
    
    console.log("✅ Upload successful! Image URL:", imageUrl);
    
    // Verify the file exists
    const UPLOAD_DIR = process.env.LIARA_DISK_PATH
      ? path.join(process.env.LIARA_DISK_PATH, 'uploads')
      : path.join(process.cwd(), 'uploads');
    
    const filename = imageUrl.split('/').pop();
    const filePath = path.join(UPLOAD_DIR, filename);
    
    try {
      await fs.access(filePath);
      console.log("✅ File exists on disk:", filePath);
    } catch (error) {
      console.warn("⚠️ File not found on disk:", filePath);
    }
    
    return true;
  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testLiaraDiskUpload().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testLiaraDiskUpload };