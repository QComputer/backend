import express from "express";
import {
  addComment,
  getProductComments,
  getUserComments,
  updateComment,
  deleteComment,
} from "../controllers/commentController.js";
import { authMiddleware } from "../middleware/auth.js";

const commentRouter = express.Router();

commentRouter.post("/add", authMiddleware({ requireAuth: true }), addComment);
commentRouter.get("/product/:productId", authMiddleware({ requireAuth: true }), getProductComments);
commentRouter.get("/user/:userId", authMiddleware({ requireAuth: true }), getUserComments);
commentRouter.put("/:id", authMiddleware({ requireAuth: true }), updateComment);
commentRouter.delete("/:id", authMiddleware({ requireAuth: true }), deleteComment);

export default commentRouter;