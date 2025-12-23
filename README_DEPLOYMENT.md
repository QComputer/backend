# Zero Community Backend - Deployment Guide

This directory contains all the necessary files and documentation for deploying the Zero Community Backend application.

## Quick Start Deployment

### 1. Environment Setup
```bash
# Copy environment template
cp .env.production.example .env.production

# Edit with your production values
nano .env.production
```

### 2. Deploy to Runflare

#### Using Dashboard (Recommended):
1. Go to [Runflare Dashboard](https://app.runflare.com)
2. Create new app
3. Connect your Git repository (GitHub, GitLab, or Bitbucket)
4. Configure build settings:
   - Build command: `npm install`
   - Start command: `npm start`
   - Port: `3000`
   - Runtime: `Node.js 20.x`
5. Set environment variables from `.env.production`
6. Deploy

#### Alternative: Manual Upload
If you can't connect to Git:
1. Zip your backend directory (excluding `node_modules`)
2. Go to Runflare Dashboard
3. Create new app
4. Upload your zip file
5. Configure environment variables
6. Deploy

### 3. Required Environment Variables

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=your-secure-secret
MONGO_URI=mongodb+srv://...
FRONTEND_URL=https://your-frontend.com
```

## Files Included

- `runflare.json` - Runflare deployment configuration
- `Dockerfile` - Docker container configuration
- `docker-compose.yml` - Local development with Docker
- `.env.production.example` - Production environment template
- `DEPLOYMENT_RUNFLARE.md` - Detailed deployment guide

## Health Check

Your application includes a health check endpoint:
- **URL**: `/health`
- **Response**: JSON status of database, sessions, and system metrics

## API Documentation

- **Swagger UI**: `/api-docs`
- **API Base**: `/api/v1/`
- **Health Check**: `/health`

## Alternative Deployment Platforms

If Runflare doesn't meet your needs, consider:
- **Render.com** - Similar to Runflare with free tier
- **Railway.app** - Modern deployment platform
- **Vercel** - Excellent for full-stack applications
- **Heroku** - Well-established platform

## Support

For deployment issues, refer to:
1. [DEPLOYMENT_RUNFLARE.md](./DEPLOYMENT_RUNFLARE.md) - Complete deployment guide
2. [Runflare Documentation](https://docs.runflare.com)
3. Application logs in Runflare dashboard