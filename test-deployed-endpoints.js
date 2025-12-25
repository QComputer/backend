import fetch from 'node-fetch';

const BACKEND_URL = 'https://sefr-backend.liara.run';

async function testDeployedEndpoints() {
  console.log('🚀 Testing deployed endpoints...\n');

  // Test 1: Check backend health
  console.log('🧪 Testing backend health endpoint...');
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    const data = await response.json();
    console.log('✅ Backend health:', data.status);
    console.log('   - Database:', data.database?.status);
    console.log('   - Disk connected:', data.disk?.available);
    if (data.disk?.diskInfo) {
      console.log('   - Disk usage:', data.disk.diskInfo.usagePercentage.toFixed(2) + '%');
    }
  } catch (error) {
    console.error('❌ Backend health test failed:', error.message);
  }

  // Test 2: Check new disk health endpoint
  console.log('\n🧪 Testing new disk health endpoint...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/image/disk/health`);
    const data = await response.json();
    console.log('✅ Disk health endpoint:');
    console.log('   - Disk connected:', data.data.diskConnected);
    console.log('   - Upload directory:', data.data.uploadDirectory);
    if (data.data.diskInfo) {
      console.log('   - Total space:', formatBytes(data.data.diskInfo.totalSpace));
      console.log('   - Free space:', formatBytes(data.data.diskInfo.freeSpace));
      console.log('   - Usage:', data.data.diskInfo.usagePercentage.toFixed(2) + '%');
    }
  } catch (error) {
    console.error('❌ Disk health endpoint test failed:', error.message);
  }

  // Test 3: Check new disk space endpoint
  console.log('\n🧪 Testing new disk space endpoint...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/image/disk/space`);
    const data = await response.json();
    console.log('✅ Disk space endpoint:');
    console.log('   - Upload directory:', data.data.uploadDirectory);
    console.log('   - Total space:', formatBytes(data.data.diskStats.totalSpace));
    console.log('   - Free space:', formatBytes(data.data.diskStats.freeSpace));
    console.log('   - Used space:', formatBytes(data.data.diskStats.usedSpace));
    console.log('   - Usage:', data.data.diskStats.usagePercentage.toFixed(2) + '%');
    console.log('   - File count:', data.data.fileCount);
    console.log('   - Total file size:', formatBytes(data.data.totalFileSize));
  } catch (error) {
    console.error('❌ Disk space endpoint test failed:', error.message);
  }

  // Test 4: Test image service health
  console.log('\n🧪 Testing image service health...');
  try {
    const response = await fetch(`${IMAGE_SERVICE_URL}/health`);
    const data = await response.json();
    console.log('✅ Image service health:', data.status);
    console.log('   - Service version:', data.version || 'unknown');
  } catch (error) {
    console.error('❌ Image service health test failed:', error.message);
  }

  // Test 5: Test image upload to image service
  console.log('\n🧪 Testing image upload to image service...');
  try {
    // Create a simple test image
    const testImageBuffer = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    
    const formData = new URLSearchParams();
    formData.append('image', testImageBuffer.toString('base64'));
    
    const response = await fetch(`${IMAGE_SERVICE_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log('✅ Image upload to image service successful');
      console.log('   - Image URL:', data.data.url);
    } else {
      console.error('❌ Image upload failed:', data.message);
    }
  } catch (error) {
    console.error('❌ Image upload test failed:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All deployed endpoint tests completed!');
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Run the tests
testDeployedEndpoints();