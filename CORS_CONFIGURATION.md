# CORS Configuration Guide

This document explains how to configure CORS (Cross-Origin Resource Sharing) for the Zero Community Backend API.

## Problem Solved

The frontend deployed on `https://sefr.liara.run` was unable to communicate with the backend deployed on `https://sefr.runflare.run` due to CORS policy violations.

## Solution Implemented

### 1. Environment Configuration

Added the deployed frontend URL to the allowed origins in `.env`:

```env
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004,https://sefr.liara.run"
```

### 2. Enhanced CORS Middleware

Created a dedicated CORS configuration file (`middleware/corsConfig.js`) with:

- **Flexible origin handling**: Supports multiple origins from environment variables
- **Development vs Production**: Different origins for different environments
- **Comprehensive logging**: Detailed CORS request logging for debugging
- **Robust error handling**: Proper error messages for blocked requests
- **Preflight request support**: Explicit handling of OPTIONS requests

### 3. Key Features

- **Origin validation**: Only allows requests from configured origins
- **Credential support**: Enables cookies and authentication headers
- **Method restrictions**: Limits allowed HTTP methods
- **Header validation**: Controls which headers can be sent
- **Preflight caching**: 24-hour cache for OPTIONS requests

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins | `""` |
| `FRONTEND_URL` | Primary frontend URL | `""` |
| `NODE_ENV` | Environment (development/production) | `"development"` |

### CORS Headers

- **Access-Control-Allow-Origin**: Set to allowed origin or `*`
- **Access-Control-Allow-Credentials**: `true` (enables cookies/auth)
- **Access-Control-Allow-Methods**: `GET,POST,PUT,DELETE,PATCH,OPTIONS`
- **Access-Control-Allow-Headers**: `Content-Type,Authorization,token,x-api-version,x-session-id`
- **Access-Control-Expose-Headers**: `X-Total-Count`

## Testing CORS

### Manual Testing

1. **Check backend accessibility**:
   ```bash
   curl https://sefr.runflare.run/health
   ```

2. **Test preflight request**:
   ```bash
   curl -X OPTIONS \
     -H "Origin: https://sefr.liara.run" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     https://sefr.runflare.run/api/v1/user/login
   ```

3. **Test actual request**:
   ```bash
   curl -X POST \
     -H "Origin: https://sefr.liara.run" \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}' \
     https://sefr.runflare.run/api/v1/user/login
   ```

### Automated Testing

Run the CORS test script:

```bash
node test-cors.js
```

This script will:
- Test backend accessibility
- Verify preflight OPTIONS requests
- Test actual POST requests
- Check CORS headers
- Provide troubleshooting guidance

## Troubleshooting

### Common Issues

1. **CORS Error: "No 'Access-Control-Allow-Origin' header"**
   - ✅ Solution: Add the frontend URL to `CORS_ALLOWED_ORIGINS`

2. **CORS Error: "Credentials flag is 'true'"**
   - ✅ Solution: Ensure `credentials: true` in CORS config and frontend requests

3. **Preflight Request Failing**
   - ✅ Solution: Check `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`

4. **Development vs Production Issues**
   - ✅ Solution: Use different `.env` files for different environments

### Debugging Steps

1. **Check server logs** for CORS-related messages
2. **Verify environment variables** are loaded correctly
3. **Test with curl** to isolate frontend/backend issues
4. **Use browser developer tools** to inspect network requests
5. **Run the test script** for automated diagnosis

### Environment-Specific Configuration

#### Development
```env
NODE_ENV=development
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:3002"
FRONTEND_URL=http://localhost:3002
```

#### Production
```env
NODE_ENV=production
CORS_ALLOWED_ORIGINS="https://sefr.liara.run,https://your-other-frontend.com"
FRONTEND_URL=https://sefr.liara.run
```

## Security Considerations

- **Never use wildcard origins** (`*`) in production with credentials
- **Validate all origins** before adding them to allowed list
- **Use HTTPS** for production deployments
- **Limit allowed methods** to only what's necessary
- **Monitor CORS logs** for suspicious activity

## Deployment Notes

When deploying to Runflare or other platforms:

1. **Set environment variables** in the deployment configuration
2. **Use production environment file** (`.env.production`)
3. **Verify CORS configuration** after deployment
4. **Test all endpoints** that frontend will use
5. **Monitor logs** for any CORS-related issues

## Files Modified

- `.env` - Added frontend URL to CORS allowed origins
- `middleware/unifiedMiddleware.js` - Enhanced CORS configuration
- `middleware/corsConfig.js` - New dedicated CORS middleware
- `server.js` - Integrated new CORS configuration
- `.env.production` - Production environment template
- `test-cors.js` - CORS testing script
- `CORS_CONFIGURATION.md` - This documentation file