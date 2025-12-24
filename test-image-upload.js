/**
 * Image Upload Test Script
 * Tests the complete image upload flow from frontend to backend to image service
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BACKEND_URL = 'https://sefr.runflare.run';
const IMAGE_SERVER_URL = 'https://zero-community-image.onrender.com';
const FRONTEND_URL = 'https://sefr.liara.run';

// Test user credentials (you'll need to create a test user first)
const TEST_USER = {
  username: 'testuser',
  password: 'testpassword123'
};

async function createTestImage() {
  // Create a simple test image (1x1 pixel PNG)
  const testImageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );
  
  return {
    buffer: testImageBuffer,
    filename: 'test-image.png',
    mimetype: 'image/png'
  };
}

async function testImageUpload() {
  console.log('📸 Testing Image Upload Flow...\n');
  
  try {
    // Step 1: Test if image service is accessible
    console.log('1. Testing image service accessibility...');
    const imageServiceHealth = await fetch(`${IMAGE_SERVER_URL}/health`);
    console.log(`   Image Service Status: ${imageServiceHealth.status} ${imageServiceHealth.statusText}`);
    
    if (!imageServiceHealth.ok) {
      console.log('   ⚠️ Image service is not accessible');
    } else {
      const healthData = await imageServiceHealth.json();
      console.log(`   Image Service Health: ${healthData.status}`);
    }

    // Step 2: Test if backend is accessible
    console.log('\n2. Testing backend accessibility...');
    const backendHealth = await fetch(`${BACKEND_URL}/health`);
    console.log(`   Backend Status: ${backendHealth.status} ${backendHealth.statusText}`);
    
    if (!backendHealth.ok) {
      console.log('   ⚠️ Backend is not accessible');
      return;
    }

    // Step 3: Test CORS configuration
    console.log('\n3. Testing CORS configuration...');
    const corsTest = await fetch(`${BACKEND_URL}/api/v1/image/upload`, {
      method: 'OPTIONS',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    });
    
    console.log(`   CORS Preflight Status: ${corsTest.status} ${corsTest.statusText}`);
    console.log(`   Allow-Origin: ${corsTest.headers.get('access-control-allow-origin')}`);
    console.log(`   Allow-Credentials: ${corsTest.headers.get('access-control-allow-credentials')}`);

    // Step 4: Create test image
    console.log('\n4. Creating test image...');
    const testImage = await createTestImage();
    console.log(`   Test image created: ${testImage.filename} (${testImage.mimetype})`);

    // Step 5: Test direct image service upload
    console.log('\n5. Testing direct image service upload...');
    const imageFormData = new FormData();
    imageFormData.append('image', testImage.buffer, {
      filename: testImage.filename,
      contentType: testImage.mimetype
    });

    const directUploadResponse = await fetch(`${IMAGE_SERVER_URL}/upload`, {
      method: 'POST',
      body: imageFormData,
      headers: {
        ...imageFormData.getHeaders()
      }
    });

    console.log(`   Direct Upload Status: ${directUploadResponse.status} ${directUploadResponse.statusText}`);
    
    if (directUploadResponse.ok) {
      const directResult = await directUploadResponse.json();
      console.log(`   Direct Upload URL: ${directResult.data.url}`);
    } else {
      const errorData = await directUploadResponse.text();
      console.log(`   Direct Upload Error: ${errorData}`);
    }

    // Step 6: Test backend image upload (this requires authentication)
    console.log('\n6. Testing backend image upload...');
    console.log('   Note: This requires a valid user session/token');
    console.log('   If you have a test user, you can uncomment the authentication code below');

    // Uncomment and modify this section if you have a test user
    /*
    // First, login to get a token
    const loginResponse = await fetch(`${BACKEND_URL}/api/v1/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL
      },
      body: JSON.stringify({
        username: TEST_USER.username,
        password: TEST_USER.password
      })
    });

    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      const token = loginData.data.token;

      // Now try to upload with the token
      const backendFormData = new FormData();
      backendFormData.append('image', testImage.buffer, {
        filename: testImage.filename,
        contentType: testImage.mimetype
      });

      const backendUploadResponse = await fetch(`${BACKEND_URL}/api/v1/image/upload`, {
        method: 'POST',
        body: backendFormData,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Origin': FRONTEND_URL,
          ...backendFormData.getHeaders()
        }
      });

      console.log(`   Backend Upload Status: ${backendUploadResponse.status} ${backendUploadResponse.statusText}`);
      
      if (backendUploadResponse.ok) {
        const backendResult = await backendUploadResponse.json();
        console.log(`   Backend Upload URL: ${backendResult.data.url}`);
        console.log(`   Image ID: ${backendResult.data.id}`);
      } else {
        const errorData = await backendUploadResponse.text();
        console.log(`   Backend Upload Error: ${errorData}`);
      }
    } else {
      console.log('   Cannot test backend upload - login failed');
      console.log('   Please create a test user and update the TEST_USER object');
    }
    */

    console.log('\n✅ Image upload test completed!');
    console.log('\n📝 Summary:');
    console.log(`   - Image service accessible: ${imageServiceHealth.ok ? 'Yes' : 'No'}`);
    console.log(`   - Backend accessible: ${backendHealth.ok ? 'Yes' : 'No'}`);
    console.log(`   - CORS configured: ${corsTest.ok ? 'Yes' : 'No'}`);
    console.log(`   - Direct image upload: ${directUploadResponse.ok ? 'Working' : 'Failed'}`);

    if (!directUploadResponse.ok) {
      console.log('\n🔧 Troubleshooting steps for image upload issues:');
      console.log('1. Check if image service is running and accessible');
      console.log('2. Verify image service CORS configuration');
      console.log('3. Check image file format and size limits');
      console.log('4. Ensure proper Content-Type headers are set');
      console.log('5. Check server logs for detailed error messages');
    }

  } catch (error) {
    console.error('❌ Image upload test failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check network connectivity to both services');
    console.log('2. Verify service URLs are correct');
    console.log('3. Check if services are running and responding');
    console.log('4. Review server logs for errors');
  }
}

async function testImageServiceEndpoints() {
  console.log('\n🔍 Testing Image Service Endpoints...\n');
  
  const endpoints = [
    { path: '/health', method: 'GET', description: 'Health check' },
    { path: '/upload', method: 'POST', description: 'Image upload' },
    { path: '/list', method: 'GET', description: 'List images' },
    { path: '/backup', method: 'GET', description: 'Download backup' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${IMAGE_SERVER_URL}${endpoint.path}`, {
        method: endpoint.method
      });
      
      console.log(`${endpoint.method} ${endpoint.path}: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (error) {
      console.log(`${endpoint.method} ${endpoint.path}: Error - ${error.message}`);
    }
  }
}

// Run all tests
async function runAllTests() {
  await testImageUpload();
  await testImageServiceEndpoints();
}

runAllTests();