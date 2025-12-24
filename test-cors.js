/**
 * CORS Configuration Test Script
 * Run this script to test if CORS is properly configured
 */

import fetch from 'node-fetch';

const BACKEND_URL = 'https://sefr.runflare.run';
const FRONTEND_URL = 'https://sefr.liara.run';

async function testCORS() {
  console.log('🧪 Testing CORS Configuration...\n');

  try {
    // Test 1: Check if the backend is accessible
    console.log('1. Testing backend accessibility...');
    const healthResponse = await fetch(`${BACKEND_URL}/health`);
    console.log(`   Status: ${healthResponse.status} ${healthResponse.statusText}`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log(`   Backend Status: ${healthData.status}`);
      console.log(`   Backend Version: ${healthData.server?.version}`);
    }

    // Test 2: Test preflight OPTIONS request
    console.log('\n2. Testing preflight OPTIONS request...');
    const optionsResponse = await fetch(`${BACKEND_URL}/api/v1/user/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    });
    
    console.log(`   OPTIONS Status: ${optionsResponse.status} ${optionsResponse.statusText}`);
    console.log(`   Access-Control-Allow-Origin: ${optionsResponse.headers.get('access-control-allow-origin')}`);
    console.log(`   Access-Control-Allow-Methods: ${optionsResponse.headers.get('access-control-allow-methods')}`);
    console.log(`   Access-Control-Allow-Headers: ${optionsResponse.headers.get('access-control-allow-headers')}`);
    console.log(`   Access-Control-Allow-Credentials: ${optionsResponse.headers.get('access-control-allow-credentials')}`);

    // Test 3: Test actual POST request (without credentials)
    console.log('\n3. Testing actual POST request...');
    const postResponse = await fetch(`${BACKEND_URL}/api/v1/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL
      },
      body: JSON.stringify({
        username: 'test',
        password: 'test'
      })
    });

    console.log(`   POST Status: ${postResponse.status} ${postResponse.statusText}`);
    console.log(`   Access-Control-Allow-Origin: ${postResponse.headers.get('access-control-allow-origin')}`);
    console.log(`   Access-Control-Allow-Credentials: ${postResponse.headers.get('access-control-allow-credentials')}`);

    if (postResponse.ok) {
      const result = await postResponse.json();
      console.log(`   Response: ${JSON.stringify(result, null, 2)}`);
    }

    console.log('\n✅ CORS test completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - Backend accessible: ${healthResponse.ok ? 'Yes' : 'No'}`);
    console.log(`   - Preflight working: ${optionsResponse.ok ? 'Yes' : 'No'}`);
    console.log(`   - CORS headers present: ${postResponse.headers.get('access-control-allow-origin') ? 'Yes' : 'No'}`);

  } catch (error) {
    console.error('❌ CORS test failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check if the backend server is running');
    console.log('2. Verify the CORS_ALLOWED_ORIGINS environment variable');
    console.log('3. Ensure the frontend URL is correctly configured');
    console.log('4. Check server logs for CORS errors');
  }
}

// Run the test
testCORS();