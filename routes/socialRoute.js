import express from "express";
import {
  followUser,
  unfollowUser,
  addFriend,
  removeFriend,
  getSocialRelationships,
  getRelationshipStatus,
  getMutualFriends,
  getFriendSuggestions
} from "../controllers/socialController.js";
import { authMiddleware } from "../middleware/auth.js";

const socialRouter = express.Router();

socialRouter.post("/follow", authMiddleware({ requireAuth: true }), followUser);
socialRouter.post("/unfollow", authMiddleware({ requireAuth: true }), unfollowUser);
socialRouter.post("/add-friend", authMiddleware({ requireAuth: true }), addFriend);
socialRouter.post("/remove-friend", authMiddleware({ requireAuth: true }), removeFriend);
socialRouter.get("/relationships", authMiddleware({ requireAuth: true }), getSocialRelationships);
socialRouter.get("/status/:targetUserId", authMiddleware({ requireAuth: true }), getRelationshipStatus);
socialRouter.get("/mutual-friends/:targetUserId", authMiddleware({ requireAuth: true }), getMutualFriends);
socialRouter.get("/friend-suggestions", authMiddleware({ requireAuth: true }), getFriendSuggestions);

export default socialRouter;