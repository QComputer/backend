import express from "express";
import {
  addComment,
  getProductComments,
  getUserComments,
  updateComment,
  deleteComment,
} from "../controllers/commentController.js";
import { unifiedAuth } from "../middleware/auth.js";

const commentRouter = express.Router();

commentRouter.post("/add", unifiedAuth, addComment);
commentRouter.get("/product/:productId", unifiedAuth, getProductComments);
commentRouter.get("/user/:userId", unifiedAuth, getUserComments);
commentRouter.put("/:id", unifiedAuth, updateComment);
commentRouter.delete("/:id", unifiedAuth, deleteComment);

export default commentRouter;