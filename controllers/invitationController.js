import invitationModel from "../models/invitationModel.js";
import userModel from "../models/userModel.js";
import crypto from "crypto";
import winston from "winston";
import qrcode from "qrcode";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Generate a unique invitation token
const generateInvitationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Create invitation link for staff or customer
export const createInvitation = async (req, res) => {
  try {
    const { type } = req.body; // 'staff' or 'customer'
    const userId = req.userId;

    if (!type || !['staff', 'customer'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invitation type. Must be 'staff' or 'customer'"
      });
    }

    // Verify user is a store
    const user = await userModel.findById(userId);
    if (!user || user.role !== 'store') {
      return res.status(403).json({
        success: false,
        message: "Only stores can create invitations"
      });
    }

    // Generate unique token
    const token = generateInvitationToken();

    // Create invitation
    const invitation = new invitationModel({
      token,
      type,
      createdBy: userId,
      storeId: userId, // For staff, store is the creator; for customers, it's also the creator
    });

    await invitation.save();

    // Generate invitation URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    const invitationUrl = `${baseUrl}/register?token=${token}&type=${type}`;

    // Generate QR code
    const qrCodeDataURL = await qrcode.toDataURL(invitationUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    logger.info(`Invitation created: ${type} by store ${userId}`);

    res.json({
      success: true,
      message: `${type} invitation created successfully`,
      data: {
        token,
        type,
        invitationUrl,
        qrCode: qrCodeDataURL,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    logger.error('Error creating invitation:', error);
    res.status(500).json({
      success: false,
      message: "Error creating invitation",
      error: error.message
    });
  }
};

// Get invitation details (for registration page)
export const getInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await invitationModel.findOne({ token })
      .populate('createdBy', 'name username')
      .populate('storeId', 'name username');

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Invalid invitation token"
      });
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Invitation has expired"
      });
    }

    // Check if invitation has been used
    if (invitation.isUsed) {
      return res.status(400).json({
        success: false,
        message: "Invitation has already been used"
      });
    }

    res.json({
      success: true,
      data: {
        type: invitation.type,
        store: invitation.storeId,
        createdBy: invitation.createdBy,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    logger.error('Error getting invitation:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving invitation",
      error: error.message
    });
  }
};

// Get store's invitations
const getStoreInvitations = async (req, res) => {
  try {
    const userId = req.userId;

    // Verify user is a store
    const user = await userModel.findById(userId);
    if (!user || user.role !== 'store') {
      return res.status(403).json({
        success: false,
        message: "Only stores can view invitations"
      });
    }

    const invitations = await invitationModel.find({
      createdBy: userId
    })
    .populate('usedBy', 'name username')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: invitations
    });
  } catch (error) {
    logger.error('Error getting store invitations:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving invitations",
      error: error.message
    });
  }
};

// Delete invitation
const deleteInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.userId;

    const invitation = await invitationModel.findOne({ token, createdBy: userId });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Invitation not found"
      });
    }

    await invitationModel.findByIdAndDelete(invitation._id);

    logger.info(`Invitation deleted: ${token} by store ${userId}`);

    res.json({
      success: true,
      message: "Invitation deleted successfully"
    });
  } catch (error) {
    logger.error('Error deleting invitation:', error);
    res.status(500).json({
      success: false,
      message: "Error deleting invitation",
      error: error.message
    });
  }
};

export {
  getStoreInvitations,
  deleteInvitation
};