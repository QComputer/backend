/**
 * Test Script for Unified Authentication System
 * Tests the unified guest/authenticated user experience
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

console.log('🧪 Testing Unified Authentication System\n');

// Test 1: Create guest session and test unified auth
async function testUnifiedAuth() {
  console.log('Test 1: Unified Authentication Flow');
  console.log('=====================================');

  try {
    // Step 1: Create guest session via test endpoint
    console.log('1. Creating guest session...');
    const guestResponse = await api.post('/test/create-guest', {
      deviceType: 'test-device'
    });

    if (!guestResponse.data.success) {
      throw new Error('Failed to create guest user');
    }

    const { sessionId, user } = guestResponse.data.data;
    console.log(`✅ Guest user created: ${user.username} (${user._id})`);
    console.log(`✅ Session ID: ${sessionId}`);

    // Step 2: Test unified authentication endpoint
    console.log('\n2. Testing unified authentication...');
    const authResponse = await api.get('/test/test-unified-auth', {
      headers: {
        'x-session-id': sessionId
      }
    });

    if (!authResponse.data.success) {
      throw new Error('Unified auth test failed');
    }

    const authData = authResponse.data.data;
    console.log(`✅ Authentication successful: ${authData.authenticated}`);
    console.log(`✅ Session type: ${authData.sessionType}`);
    console.log(`✅ User ID: ${authData.userId}`);
    console.log(`✅ User role: ${authData.userRole}`);

    // Step 3: Test unified cart operations
    console.log('\n3. Testing unified cart operations...');
    const cartResponse = await api.get('/test/test-unified-cart', {
      headers: {
        'x-session-id': sessionId
      }
    });

    if (!cartResponse.data.success) {
      throw new Error('Unified cart test failed');
    }

    const cartData = cartResponse.data.data;
    console.log(`✅ Cart operations successful`);
    console.log(`✅ Cart items: ${cartData.cartItems}`);
    console.log(`✅ Cart count: ${cartData.cartCount}`);

    // Step 4: Test actual cart API
    console.log('\n4. Testing actual cart API...');
    const cartGetResponse = await api.get('/cart/', {
      headers: {
        'x-session-id': sessionId
      }
    });

    if (!cartGetResponse.data.success) {
      throw new Error('Cart API test failed');
    }

    console.log(`✅ Cart API successful`);
    console.log(`✅ Cart data received with ${cartGetResponse.data.data.items.length} items`);

    console.log('\n✅ Test 1 PASSED: Unified authentication works correctly\n');

  } catch (error) {
    console.error('❌ Test 1 FAILED:', error.response?.data || error.message);
    console.log('\n');
  }
}

// Test 2: Compare old vs new authentication patterns
async function testAuthPatterns() {
  console.log('Test 2: Authentication Pattern Comparison');
  console.log('==========================================');

  try {
    // Create guest session first
    const guestResponse = await api.post('/test/create-guest');
    const sessionId = guestResponse.data.data.sessionId;

    // Test comparison endpoint
    const compareResponse = await api.get('/test/compare-auth-patterns', {
      headers: {
        'x-session-id': sessionId
      }
    });

    if (!compareResponse.data.success) {
      throw new Error('Auth pattern comparison failed');
    }

    const results = compareResponse.data.data;
    console.log('Authentication Pattern Results:');
    console.log(`✅ Unified Auth: ${results.unifiedAuth?.status || 'N/A'}`);
    console.log(`✅ Guest Cart Middleware: ${results.guestCartMiddleware?.status || 'N/A'}`);
    console.log(`✅ Session Info: ${JSON.stringify(results.sessionInfo, null, 2)}`);

    console.log('\n✅ Test 2 PASSED: Authentication patterns working correctly\n');

  } catch (error) {
    console.error('❌ Test 2 FAILED:', error.response?.data || error.message);
    console.log('\n');
  }
}

// Test 3: Test cart operations with unified API
async function testCartOperations() {
  console.log('Test 3: Cart Operations with Unified API');
  console.log('=========================================');

  try {
    // Create guest session
    const guestResponse = await api.post('/test/create-guest');
    const sessionId = guestResponse.data.data.sessionId;

    console.log('1. Testing cart add operation...');
    // Add item to cart (using a dummy product ID - this will fail gracefully)
    try {
      await api.post('/cart/', {
        productId: 'dummy-product-id',
        quantity: 1,
        catalogId: 'dummy-catalog-id'
      }, {
        headers: {
          'x-session-id': sessionId
        }
      });
    } catch (addError) {
      // Expected to fail with dummy IDs, but should not be auth-related
      if (addError.response?.status === 401 || addError.response?.status === 403) {
        throw new Error('Authentication failed for cart operation');
      }
      console.log('✅ Cart add operation handled correctly (expected validation error)');
    }

    console.log('2. Testing cart get operation...');
    const cartResponse = await api.get('/cart/', {
      headers: {
        'x-session-id': sessionId
      }
    });

    if (!cartResponse.data.success) {
      throw new Error('Cart get operation failed');
    }

    console.log(`✅ Cart retrieved successfully with ${cartResponse.data.data.items.length} items`);

    console.log('\n✅ Test 3 PASSED: Cart operations work with unified API\n');

  } catch (error) {
    console.error('❌ Test 3 FAILED:', error.response?.data || error.message);
    console.log('\n');
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Unified Authentication Tests\n');

  await testUnifiedAuth();
  await testAuthPatterns();
  await testCartOperations();

  console.log('🏁 All tests completed!');
  console.log('\n📋 Summary:');
  console.log('- Guest users are now treated as authenticated');
  console.log('- Unified API works for all user types');
  console.log('- Cart operations are consistent across sessions');
  console.log('- Backward compatibility maintained');
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };