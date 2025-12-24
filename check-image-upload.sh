#!/bin/bash

# Image Upload Verification Script
# This script tests the complete image upload flow from frontend to backend to image service

echo "📸 Image Upload Verification Script"
echo "=================================="
echo ""

# Configuration
BACKEND_URL="https://sefr.runflare.run"
IMAGE_SERVER_URL="https://zero-community-image.onrender.com"
FRONTEND_URL="https://sefr.liara.run"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Test 1: Check if services are accessible
echo "1. Testing Service Accessibility"
echo "--------------------------------"

print_status "Testing backend health..."
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
if [ "$BACKEND_HEALTH" = "200" ]; then
    print_success "Backend is accessible (HTTP $BACKEND_HEALTH)"
else
    print_error "Backend is not accessible (HTTP $BACKEND_HEALTH)"
fi

print_status "Testing image service health..."
IMAGE_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$IMAGE_SERVER_URL/health")
if [ "$IMAGE_HEALTH" = "200" ]; then
    print_success "Image service is accessible (HTTP $IMAGE_HEALTH)"
else
    print_error "Image service is not accessible (HTTP $IMAGE_HEALTH)"
fi

# Test 2: Test CORS configuration
echo ""
echo "2. Testing CORS Configuration"
echo "----------------------------"

print_status "Testing CORS preflight for image upload..."
CORS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X OPTIONS \
    -H "Origin: $FRONTEND_URL" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type,Authorization" \
    "$BACKEND_URL/api/v1/image/upload")

if [ "$CORS_RESPONSE" = "200" ] || [ "$CORS_RESPONSE" = "204" ]; then
    print_success "CORS preflight successful (HTTP $CORS_RESPONSE)"
else
    print_error "CORS preflight failed (HTTP $CORS_RESPONSE)"
fi

# Test 3: Test direct image upload to image service
echo ""
echo "3. Testing Direct Image Upload"
echo "------------------------------"

# Create a test image (1x1 pixel PNG)
TEST_IMAGE_DATA="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
echo "$TEST_IMAGE_DATA" | base64 -d > test_image.png

print_status "Uploading test image to image service..."
UPLOAD_RESPONSE=$(curl -s -w "%{http_code}" \
    -F "image=@test_image.png;type=image/png" \
    "$IMAGE_SERVER_URL/upload")

HTTP_CODE="${UPLOAD_RESPONSE: -3}"
RESPONSE_BODY="${UPLOAD_RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Direct image upload successful (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
else
    print_error "Direct image upload failed (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
fi

# Test 4: Test image service endpoints
echo ""
echo "4. Testing Image Service Endpoints"
echo "----------------------------------"

ENDPOINTS=("/health" "/list" "/backup")

for endpoint in "${ENDPOINTS[@]}"; do
    print_status "Testing $endpoint..."
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$IMAGE_SERVER_URL$endpoint")
    if [ "$STATUS" = "200" ]; then
        print_success "$endpoint: OK (HTTP $STATUS)"
    else
        print_warning "$endpoint: Failed (HTTP $STATUS)"
    fi
done

# Test 5: Test backend image upload (without authentication)
echo ""
echo "5. Testing Backend Image Upload (No Auth)"
echo "-----------------------------------------"

print_status "Attempting upload without authentication..."
AUTH_TEST=$(curl -s -w "%{http_code}" \
    -F "image=@test_image.png;type=image/png" \
    "$BACKEND_URL/api/v1/image/upload")

AUTH_STATUS="${AUTH_TEST: -3}"
AUTH_RESPONSE="${AUTH_TEST%???}"

if [ "$AUTH_STATUS" = "401" ]; then
    print_success "Authentication required (HTTP $AUTH_STATUS) - This is expected"
elif [ "$AUTH_STATUS" = "200" ]; then
    print_warning "Upload succeeded without auth (HTTP $AUTH_STATUS) - Check security"
    echo "Response: $AUTH_RESPONSE"
else
    print_error "Upload failed (HTTP $AUTH_STATUS)"
    echo "Response: $AUTH_RESPONSE"
fi

# Test 6: Test CORS headers
echo ""
echo "6. Testing CORS Headers"
echo "-----------------------"

print_status "Checking CORS headers for image upload endpoint..."
CORS_HEADERS=$(curl -s -I -X OPTIONS \
    -H "Origin: $FRONTEND_URL" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type,Authorization" \
    "$BACKEND_URL/api/v1/image/upload")

echo "$CORS_HEADERS" | grep -i "access-control" | while read header; do
    echo "  $header"
done

# Test 7: Test frontend URL accessibility
echo ""
echo "7. Testing Frontend URL"
echo "-----------------------"

print_status "Testing frontend URL accessibility..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$FRONTEND_STATUS" = "200" ]; then
    print_success "Frontend is accessible (HTTP $FRONTEND_STATUS)"
else
    print_warning "Frontend may not be accessible (HTTP $FRONTEND_STATUS)"
fi

# Cleanup
rm -f test_image.png

# Summary
echo ""
echo "=================================="
echo "📊 SUMMARY"
echo "=================================="
echo "✅ Services tested:"
echo "   - Backend: $BACKEND_URL"
echo "   - Image Service: $IMAGE_SERVER_URL"
echo "   - Frontend: $FRONTEND_URL"
echo ""
echo "🔧 To test image upload from frontend:"
echo "   1. Open frontend-image-test.html in a browser"
echo "   2. Run the CORS test"
echo "   3. Test direct image upload"
echo "   4. Create a test user and login"
echo "   5. Test backend image upload with authentication"
echo ""
echo "📝 Additional verification scripts:"
echo "   - node test-cors.js (CORS testing)"
echo "   - node test-image-upload.js (Node.js testing)"
echo "   - frontend-image-test.html (Browser testing)"