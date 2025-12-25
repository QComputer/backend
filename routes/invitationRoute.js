import express from "express";
import {
  createInvitation,
  getInvitation,
  getStoreInvitations,
  deleteInvitation
} from "../controllers/invitationController.js";
import { authMiddleware } from "../middleware/auth.js";

const invitationRouter = express.Router();

// Create invitation (stores only)
invitationRouter.post("/create", authMiddleware({ requireAuth: true }), createInvitation);

// Get invitation details (public - for registration)
invitationRouter.get("/:token", getInvitation);

// Get store's invitations (stores only)
invitationRouter.get("/", authMiddleware({ requireAuth: true }), getStoreInvitations);

// Delete invitation (stores only)
invitationRouter.delete("/:token", authMiddleware({ requireAuth: true }), deleteInvitation);

export default invitationRouter;