import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import { setupSwaggerUI } from "./utils/swagger.js";
import { setupMiddleware } from "./middleware/unifiedMiddleware.js";
import { configureCORS } from "./middleware/corsConfig.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { successResponse, errorResponse } from "./utils/apiResponse.js";

// Import routers
import userRouter from "./routes/userRoute.js";
import productRouter from "./routes/productRoute.js";
import categoryRouter from "./routes/categoryRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import messageRouter from "./routes/messageRoute.js";
import socialRouter from "./routes/socialRoute.js";
import groupRouter from "./routes/groupRoute.js";
import commentRouter from "./routes/commentRoute.js";
import imageRouter from "./routes/imageRoute.js";
import adminRouter from "./routes/adminRoute.js";
import invitationRouter from "./routes/invitationRoute.js";
import catalogRouter from "./routes/catalogRoute.js";

// Import models to register them with Mongoose
import "./models/userModel.js";
import "./models/productModel.js";
import "./models/categoryModel.js";
import "./models/orderModel.js";
import "./models/commentModel.js";
import "./models/messageModel.js";
import "./models/socialModel.js";
import "./models/groupModel.js";
import "./models/productReactionModel.js";
import "./models/invitationModel.js";
import "./models/catalogModel.js";
import "./models/sessionModel.js";
import "./models/cartModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Setup all middleware
setupMiddleware(app);

// Configure CORS
configureCORS(app);

// Setup Swagger documentation
setupSwaggerUI(app);

// Serve static images from Liara disk
import { promises as fs } from 'fs';

const UPLOAD_DIR = process.env.LIARA_DISK_PATH
  ? path.join(process.env.LIARA_DISK_PATH, 'uploads')
  : path.join(process.cwd(), 'uploads');

// Ensure upload directory exists and serve static files
(async () => {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    console.log('Upload directory ready for static serving:', UPLOAD_DIR);
    app.use('/uploads', express.static(UPLOAD_DIR));
  } catch (error) {
    console.warn('Could not set up upload directory for static serving:', error.message);
    // Fallback to serving from the current directory if Liara disk is not available
    const FALLBACK_UPLOAD_DIR = path.join(process.cwd(), 'uploads');
    await fs.mkdir(FALLBACK_UPLOAD_DIR, { recursive: true });
    console.log('Fallback upload directory ready:', FALLBACK_UPLOAD_DIR);
    app.use('/uploads', express.static(FALLBACK_UPLOAD_DIR));
  }
})();

// API endpoints with versioning
app.use("/api/v1/user", userRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/category", categoryRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/message", messageRouter);
app.use("/api/v1/social", socialRouter);
app.use("/api/v1/group", groupRouter);
app.use("/api/v1/comment", commentRouter);
app.use("/api/v1/image", imageRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/invitation", invitationRouter);
app.use("/api/v1/catalog", catalogRouter);

// Health check endpoint (standardized)
app.get('/health', async (req, res) => {
  try {
    const dbReadyState = mongoose.connection.readyState;
    const sessionStats = await sessionCleanup.getCleanupStats();

    const healthData = {
      status: dbReadyState === 1 ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: dbReadyState === 1 ? 'connected' : 'disconnected',
        readyState: dbReadyState
      },
      sessions: sessionStats,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
    successResponse(res, healthData, "Health check successful");
  } catch (error) {
    errorResponse(res, "Health check failed", error, 500);
  }
});

// Session cleanup manual trigger (for testing)
app.post('/admin/cleanup-sessions', async (req, res) => {
  try {
    const result = await sessionCleanup.manualCleanup();
    successResponse(res, {
      message: 'Manual session cleanup completed',
      result: result
    });
  } catch (error) {
    errorResponse(res, "Session cleanup failed", error, 500);
  }
});

// Root endpoint (standardized)
app.get("/", (req, res) => {
  successResponse(res, {
    message: "Zero Community Backend API",
    status: "running",
    version: "1.0.0",
    documentation: "/api-docs",
    endpoints: {
      health: "/health",
      api: "/api/v1/*"
    }
  });
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Import session cleanup
import sessionCleanup from "./utils/sessionCleanup.js";

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();

    // Start session cleanup job
    sessionCleanup.start();

    app.listen(port, () => {
      console.log(`🚀 Zero Community Backend API v1.0.0 running on http://localhost:${port}`);
      console.log('📊 Health check: /health');
      console.log('📖 API Documentation: /api-docs');
      console.log('🔒 All API endpoints now use /api/v1/ prefix');
      console.log('🧹 Session cleanup job started (automatic guest session cleanup)');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;