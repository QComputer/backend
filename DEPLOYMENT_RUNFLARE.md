# Deploying Zero Community Backend on Runflare.com

This guide will help you deploy your Node.js backend application on Runflare.com, a cloud platform for hosting applications.

## Prerequisites

- Runflare.com account
- Node.js application ready for deployment
- MongoDB database (can be hosted on MongoDB Atlas or another provider)
- Stripe account (for payment processing)
- Image server URL (if using external image hosting)

## Step 1: Prepare Your Application

### 1.1 Update Environment Variables

Create a `.env.production` file in your backend directory with production-ready environment variables:

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=your-very-secure-jwt-secret-key-here
FRONTEND_URL=https://your-frontend-domain.com
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
GUEST_SESSION_EXPIRATION_HOURS=24
SESSION_CLEANUP_INTERVAL_HOURS=1
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/your-database-name?retryWrites=true&w=majority
IMAGE_SERVER_URL=https://your-image-server.com
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,token
```

**Important Security Notes:**
- Generate a strong JWT secret (use a tool like [jwt-secret.com](https://jwt-secret.com/))
- Use production MongoDB connection string
- Use Stripe live keys for production
- Set proper CORS origins for your frontend domain

### 1.2 Create Dockerfile (Optional but Recommended)

Create a `Dockerfile` in your backend root directory:

```dockerfile
# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
```

### 1.3 Create docker-compose.yml (Optional)

Create a `docker-compose.yml` for local testing:

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped
```

## Step 2: Prepare for Runflare Deployment

### 2.1 Create Runflare Configuration

Create a `runflare.json` configuration file in your backend directory:

```json
{
  "name": "zero-community-backend",
  "runtime": "nodejs",
  "version": "20.x",
  "port": 3000,
  "env": {
    "NODE_ENV": "production",
    "PORT": "3000"
  },
  "build": {
    "command": "npm install",
    "output": "."
  },
  "start": {
    "command": "npm start"
  },
  "health_check": {
    "path": "/health",
    "interval": 30,
    "timeout": 10,
    "retries": 3
  },
  "scaling": {
    "min_instances": 1,
    "max_instances": 3,
    "cpu_threshold": 70
  },
  "volumes": [
    {
      "name": "uploads",
      "path": "/app/uploads",
      "size": "10GB"
    }
  ]
}
```

### 2.2 Update package.json Scripts

Ensure your `package.json` has the correct scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "migrate:images": "node migrate-image-urls.js"
  }
}
```

## Step 3: Deploy to Runflare

### 3.1 Using Runflare Dashboard (Recommended)

Since the Runflare CLI may not be available, use the dashboard method:

1. **Go to Runflare Dashboard** at [https://app.runflare.com](https://app.runflare.com)
2. **Click "Create New App"**
3. **Connect your Git repository** (GitHub, GitLab, or Bitbucket)
4. **Configure build settings:**
   - Build command: `npm install`
   - Start command: `npm start`
   - Port: `3000`
   - Runtime: `Node.js 20.x`
5. **Set environment variables** (from your `.env.production`)
6. **Deploy**

### 3.2 Alternative: Manual Deployment

If you can't connect to Git, you can manually upload your code:

1. **Zip your backend directory** (excluding `node_modules`)
2. **Go to Runflare Dashboard**
3. **Create new app**
4. **Upload your zip file**
5. **Configure environment variables**
6. **Deploy**

## Step 4: Configure Environment Variables on Runflare

Set these environment variables in your Runflare dashboard:

### Required Variables:
- `PORT`: `3000`
- `NODE_ENV`: `production`
- `JWT_SECRET`: Your secure JWT secret
- `MONGO_URI`: Your MongoDB connection string
- `FRONTEND_URL`: Your frontend domain (e.g., `https://your-app.com`)

### Optional Variables:
- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `IMAGE_SERVER_URL`: Your image server URL
- `GUEST_SESSION_EXPIRATION_HOURS`: `24`
- `SESSION_CLEANUP_INTERVAL_HOURS`: `1`

## Step 5: Database Setup

### MongoDB Atlas Setup:

1. **Create MongoDB Atlas account**
2. **Create a new cluster**
3. **Set up database user and permissions**
4. **Configure IP whitelist** (allow access from anywhere for testing, or add Runflare IPs)
5. **Get connection string** and update your `MONGO_URI` environment variable

### Connection String Format:
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/zero-community?retryWrites=true&w=majority
```

## Step 6: Configure CORS and Security

Update your CORS settings in the environment variables:

```env
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com,https://api.your-app.com
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,token
```

## Step 7: SSL and Domain Configuration

### Custom Domain:
1. **Add custom domain** in Runflare dashboard
2. **Configure DNS settings** as instructed by Runflare
3. **Enable SSL** (usually automatic with Let's Encrypt)

### SSL Certificate:
Runflare typically provides automatic SSL certificates. Ensure your domain has HTTPS enabled.

## Step 8: Monitoring and Logs

### Health Check:
Your application has a built-in health check endpoint at `/health`. Configure this in your Runflare settings.

### Logging:
- Check Runflare dashboard for application logs
- Consider setting up external logging services (like LogRocket, Sentry) for production monitoring

## Step 9: Post-Deployment Tasks

### 9.1 Test Your Deployment
```bash
# Test health endpoint
curl https://your-app.runflare.app/health

# Test API endpoints
curl https://your-app.runflare.app/api/v1/user/profile
```

### 9.2 Update Frontend Configuration
Update your frontend `.env` file to point to the new backend URL:

```env
REACT_APP_API_BASE_URL=https://your-backend.runflare.app
```

### 9.3 Database Migration
If you have existing data, you may need to migrate it:

```bash
# Run migration script if needed
npm run migrate:images
```

## Troubleshooting

### Common Issues:

1. **Environment Variables Not Loading:**
   - Check Runflare dashboard environment variables
   - Verify variable names match your code

2. **Database Connection Issues:**
   - Verify MongoDB connection string
   - Check IP whitelist settings
   - Ensure database user has proper permissions

3. **CORS Errors:**
   - Verify `CORS_ALLOWED_ORIGINS` includes your frontend domain
   - Check that frontend is using HTTPS if backend requires it

4. **Port Issues:**
   - Ensure your application listens on the port specified in `PORT` environment variable
   - Default is usually 3000

5. **File Upload Issues:**
   - Verify volume mounts are configured correctly
   - Check file permissions in the uploads directory

### Getting Help:
- Runflare documentation: [https://docs.runflare.com](https://docs.runflare.com)
- Runflare support: Contact through dashboard
- Application logs: Check Runflare dashboard logs section

## Performance Optimization

### Recommended Settings:
- **Scaling:** Start with 1 instance, scale based on traffic
- **Memory:** Allocate sufficient memory for your application
- **Caching:** Consider Redis for session storage and caching
- **CDN:** Use CDN for static assets and images

### Monitoring:
- Set up performance monitoring
- Monitor database connection pool
- Track API response times
- Monitor error rates

## Security Best Practices

1. **Environment Variables:** Never commit secrets to version control
2. **HTTPS:** Always use HTTPS in production
3. **JWT Security:** Use strong secrets and proper expiration times
4. **Input Validation:** Validate all user inputs
5. **Rate Limiting:** Implement rate limiting for API endpoints
6. **Regular Updates:** Keep dependencies updated

## Alternative Deployment Platforms

If Runflare doesn't meet your needs, consider these alternatives:

### Render.com
- Similar to Runflare
- Free tier available
- Easy MongoDB integration

### Railway.app
- Modern deployment platform
- Great for Node.js applications
- Free credits available

### Vercel
- Excellent for full-stack applications
- Built-in CDN
- Easy environment management

### Heroku
- Well-established platform
- Many add-ons available
- Free tier with limitations

## Next Steps

1. **Set up monitoring and alerting**
2. **Configure backup strategies for your database**
3. **Set up CI/CD pipeline for automated deployments**
4. **Implement proper error tracking and logging**
5. **Consider implementing caching strategies**
6. **Set up performance monitoring**

Your Zero Community Backend should now be successfully deployed on Runflare.com! 🚀