import express from "express";
import {
  createGroup,
  getAllGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
} from "../controllers/groupController.js";
import { authMiddleware } from "../middleware/auth.js";

const groupRouter = express.Router();

groupRouter.post("/create", authMiddleware({ requireAuth: true }), createGroup);
groupRouter.get("/all", authMiddleware({ requireAuth: true }), getAllGroups);
groupRouter.get("/:id", authMiddleware({ requireAuth: true }), getGroupById);
groupRouter.put("/:id", authMiddleware({ requireAuth: true }), updateGroup);
groupRouter.delete("/:id", authMiddleware({ requireAuth: true }), deleteGroup);
groupRouter.post("/:id/add-member", authMiddleware({ requireAuth: true }), addMember);
groupRouter.post("/:id/remove-member", authMiddleware({ requireAuth: true }), removeMember);

export default groupRouter;