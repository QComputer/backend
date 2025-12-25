import { checkDiskHealth, getDiskSpace } from "./controllers/imageController.js";

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

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Run tests
async function runTests() {
  console.log("🚀 Starting disk endpoint tests...\n");
  
  const healthSuccess = await testDiskHealth();
  const spaceSuccess = await testDiskSpace();
  
  console.log("\n" + "=".repeat(50));
  if (healthSuccess && spaceSuccess) {
    console.log("🎉 All disk endpoint tests passed!");
    process.exit(0);
  } else {
    console.log("❌ Some tests failed!");
    process.exit(1);
  }
}

runTests();