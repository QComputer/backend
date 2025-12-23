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
import { unifiedAuth } from "../middleware/auth.js";

const groupRouter = express.Router();

groupRouter.post("/create", unifiedAuth, createGroup);
groupRouter.get("/all", unifiedAuth, getAllGroups);
groupRouter.get("/:id", unifiedAuth, getGroupById);
groupRouter.put("/:id", unifiedAuth, updateGroup);
groupRouter.delete("/:id", unifiedAuth, deleteGroup);
groupRouter.post("/:id/add-member", unifiedAuth, addMember);
groupRouter.post("/:id/remove-member", unifiedAuth, removeMember);

export default groupRouter;