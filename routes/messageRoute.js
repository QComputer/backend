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
import { unifiedAuth } from "../middleware/auth.js";

const messageRouter = express.Router();

messageRouter.post("/send", unifiedAuth, sendMessage);
messageRouter.get("/search", unifiedAuth, searchMessages);
messageRouter.get("/conversations", unifiedAuth, getConversations);
messageRouter.get("/all-conversations", unifiedAuth, getAllConversations);
messageRouter.get("/conversation/:otherUserId", unifiedAuth, getMessages);
messageRouter.get("/group/:groupId", unifiedAuth, getGroupMessages);
messageRouter.get("/unread", unifiedAuth, getUnreadMessages);
messageRouter.post("/read", unifiedAuth, markMessagesAsRead);
messageRouter.get("/:id", unifiedAuth, getMessageById);
messageRouter.put("/:id/read", unifiedAuth, markMessageAsRead);
messageRouter.delete("/:id", unifiedAuth, deleteMessage);

export default messageRouter;