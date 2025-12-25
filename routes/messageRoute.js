import express from "express";
import {
  sendMessage,
  getMessages,
  getGroupMessages,
  getConversations,
  getAllConversations,
  getUnreadMessages,
  markMessagesAsRead,
  getMessageById,
  markMessageAsRead,
  deleteMessage,
  searchMessages,
} from "../controllers/messageController.js";
import { authMiddleware } from "../middleware/auth.js";

const messageRouter = express.Router();

messageRouter.post("/send", authMiddleware({ requireAuth: true }), sendMessage);
messageRouter.get("/search", authMiddleware({ requireAuth: true }), searchMessages);
messageRouter.get("/conversations", authMiddleware({ requireAuth: true }), getConversations);
messageRouter.get("/all-conversations", authMiddleware({ requireAuth: true }), getAllConversations);
messageRouter.get("/conversation/:otherUserId", authMiddleware({ requireAuth: true }), getMessages);
messageRouter.get("/group/:groupId", authMiddleware({ requireAuth: true }), getGroupMessages);
messageRouter.get("/unread", authMiddleware({ requireAuth: true }), getUnreadMessages);
messageRouter.post("/read", authMiddleware({ requireAuth: true }), markMessagesAsRead);
messageRouter.get("/:id", authMiddleware({ requireAuth: true }), getMessageById);
messageRouter.put("/:id/read", authMiddleware({ requireAuth: true }), markMessageAsRead);
messageRouter.delete("/:id", authMiddleware({ requireAuth: true }), deleteMessage);

export default messageRouter;