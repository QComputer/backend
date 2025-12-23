import express from "express";
import {
  createInvitation,
  getInvitation,
  getStoreInvitations,
  deleteInvitation
} from "../controllers/invitationController.js";
import { unifiedAuth } from "../middleware/auth.js";

const invitationRouter = express.Router();

// Create invitation (stores only)
invitationRouter.post("/create", unifiedAuth, createInvitation);

// Get invitation details (public - for registration)
invitationRouter.get("/:token", getInvitation);

// Get store's invitations (stores only)
invitationRouter.get("/", unifiedAuth, getStoreInvitations);

// Delete invitation (stores only)
invitationRouter.delete("/:token", unifiedAuth, deleteInvitation);

export default invitationRouter;