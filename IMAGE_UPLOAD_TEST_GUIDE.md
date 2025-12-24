# Image Upload Testing Guide

This guide provides comprehensive instructions for testing the image uploading functionality from your frontend application to the deployed backend and image services.

## Deployed Services

- **Backend API**: `https://sefr.runflare.run`
- **Image Service**: `https://sefr-image.runflare.run`
- **Frontend**: `https://sefr.liara.run`

## Prerequisites

1. Ensure all three services are running and accessible
2. Have a modern browser for frontend testing
3. Have Node.js installed for script-based testing
4. Have curl installed for command-line testing

## Testing Methods

### Method 1: Browser-Based Testing (Recommended)

1. **Open the frontend test page**:
   ```bash
   # Open frontend-image-test.html in your browser
   open frontend-image-test.html
   # or
   start frontend-image-test.html
   ```

2. **Run the tests in order**:
   - **Test CORS Configuration**: Verifies that CORS is properly configured between frontend and backend
   - **Test Image Service Health**: Checks if the image service is running and accessible
   - **Test Direct Image Upload**: Tests uploading directly to the image service
   - **Create Test User**: Creates a test user account for backend testing
   - **Login Test User**: Logs in with the test user credentials
   - **Test Backend Image Upload**: Tests uploading through the backend with authentication

### Method 2: Command Line Testing

1. **Run the comprehensive test script**:
   ```bash
   chmod +x check-image-upload.sh
   ./check-image-upload.sh
   ```

2. **Run individual Node.js tests**:
   ```bash
   # Test CORS configuration
   node test-cors.js
   
   # Test image upload functionality
   node test-image-upload.js
   ```

### Method 3: Manual Testing with curl

1. **Test service accessibility**:
   ```bash
   # Test backend health
   curl https://sefr.runflare.run/health
   
   # Test image service health
   curl https://zero-community-image.onrender.com/health
   ```

2. **Test CORS configuration**:
   ```bash
   curl -X OPTIONS \
     -H "Origin: https://sefr.liara.run" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     https://sefr.runflare.run/api/v1/image/upload
   ```

3. **Test direct image upload**:
   ```bash
   curl -F "image=@your-image.jpg" \
     https://zero-community-image.onrender.com/upload
   ```

## Expected Results

### ✅ Success Indicators

1. **Services Accessible**: All three services return HTTP 200 for health checks
2. **CORS Configured**: OPTIONS requests return proper CORS headers
3. **Direct Upload Working**: Images can be uploaded directly to image service
4. **Backend Upload Working**: Images can be uploaded through backend with authentication
5. **Proper Headers**: CORS headers include your frontend URL

### ❌ Failure Indicators

1. **Services Down**: HTTP 500, 502, 503, or timeout errors
2. **CORS Issues**: OPTIONS requests blocked or missing headers
3. **Authentication Required**: Backend upload fails without proper auth
4. **Network Issues**: Connection timeouts or refused connections

## Common Issues and Solutions

### Issue 1: CORS Errors
**Symptoms**: "Cross-Origin Request Blocked" in browser console
**Solutions**:
- Verify `CORS_ALLOWED_ORIGINS` includes your frontend URL
- Check that `CORS_ALLOW_CREDENTIALS=true` is set
- Ensure frontend URL matches exactly (including protocol and port)

### Issue 2: Image Service Unavailable
**Symptoms**: HTTP 502, 503, or timeout errors
**Solutions**:
- Check if image service is running on Render
- Verify the `IMAGE_SERVER_URL` environment variable
- Check image service logs for errors

### Issue 3: Authentication Failures
**Symptoms**: HTTP 401 errors on backend upload
**Solutions**:
- Ensure user is logged in before attempting upload
- Verify JWT token is being sent in Authorization header
- Check that session is not expired

### Issue 4: File Upload Errors
**Symptoms**: HTTP 400 or 413 errors
**Solutions**:
- Check file size limits (default 10MB)
- Verify file format is supported (PNG, JPG, GIF, WebP)
- Ensure proper Content-Type headers

## Environment Configuration

### Backend Environment Variables
Ensure these are set in your backend deployment:

```env
IMAGE_SERVER_URL=https://zero-community-image.onrender.com
CORS_ALLOWED_ORIGINS="https://sefr.liara.run,https://your-other-frontend.com"
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOWED_METHODS="GET,POST,PUT,DELETE,PATCH,OPTIONS"
CORS_ALLOWED_HEADERS="Content-Type,Authorization,token,x-api-version,x-session-id"
```

### Frontend Configuration
Ensure your frontend is configured to:
- Use the correct backend API URL
- Handle CORS properly
- Include proper authentication headers
- Handle image upload responses correctly

## Testing Checklist

- [ ] Backend service accessible
- [ ] Image service accessible
- [ ] Frontend accessible
- [ ] CORS preflight requests working
- [ ] Direct image upload working
- [ ] User registration working
- [ ] User login working
- [ ] Backend image upload with auth working
- [ ] Image URLs are accessible
- [ ] Proper error handling in place

## Debugging Tips

1. **Check Browser Console**: Look for CORS errors, network failures, or JavaScript errors
2. **Check Network Tab**: Monitor actual HTTP requests and responses
3. **Check Server Logs**: Review backend and image service logs for errors
4. **Test Incrementally**: Start with simple requests and build up complexity
5. **Use Developer Tools**: Inspect request headers, response bodies, and status codes

## Next Steps

Once image upload is working correctly:

1. **Test with Real Images**: Use actual product images, not just test images
2. **Test Edge Cases**: Large files, unsupported formats, network interruptions
3. **Performance Testing**: Test with multiple concurrent uploads
4. **Security Testing**: Verify file type validation and size limits
5. **Integration Testing**: Test complete user workflows

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review server logs for detailed error messages
3. Verify all environment variables are correctly set
4. Test each component individually before testing the full flow
5. Check the deployment status of all services