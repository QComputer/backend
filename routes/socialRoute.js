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
import { unifiedAuth } from "../middleware/auth.js";

const socialRouter = express.Router();

socialRouter.post("/follow", unifiedAuth, followUser);
socialRouter.post("/unfollow", unifiedAuth, unfollowUser);
socialRouter.post("/add-friend", unifiedAuth, addFriend);
socialRouter.post("/remove-friend", unifiedAuth, removeFriend);
socialRouter.get("/relationships", unifiedAuth, getSocialRelationships);
socialRouter.get("/status/:targetUserId", unifiedAuth, getRelationshipStatus);
socialRouter.get("/mutual-friends/:targetUserId", unifiedAuth, getMutualFriends);
socialRouter.get("/friend-suggestions", unifiedAuth, getFriendSuggestions);

export default socialRouter;