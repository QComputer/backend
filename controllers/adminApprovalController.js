import adminApprovalModel from "../models/adminApprovalModel.js";
import winston from "winston";
import { standardError, standardSuccess } from "../utils/apiUtils.js";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

/**
 * Create a new admin approval request
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing approval data
 * @param {string} req.body.type - Type of approval (catalog_edit, product_edit, etc.)
 * @param {string} req.body.userId - User ID requesting approval
 * @param {string} req.body.targetId - ID of the item being edited
 * @param {Object} req.body.changes - Changes being requested
 * @param {string} req.body.reason - Reason for the changes
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const createApprovalRequest = async (req, res) => {
  try {
    const { type, userId, targetId, changes, reason } = req.body;
    const requestingUserRole = req.user?.role || 'guest';

    // Validate required fields
    if (!type || !userId || !targetId || !changes || !reason) {
      return res.status(400).json(
        standardError("Type, userId, targetId, changes, and reason are required fields", null, 400)
      );
    }

    // Create approval request
    const approvalRequest = new adminApprovalModel({
      type,
      userId,
      targetId,
      changes,
      reason,
      status: 'pending',
      requestedByRole: requestingUserRole,
      requestedAt: new Date()
    });

    await approvalRequest.save();

    logger.info(`Admin approval request created: ${type} for ${targetId} by user ${userId}`);

    res.status(201).json(
      standardSuccess("Admin approval request created successfully", approvalRequest, 201)
    );
  } catch (error) {
    logger.error("Create approval request error:", error);
    res.status(500).json(
      standardError("Internal server error", error.message, 500)
    );
  }
};

/**
 * Get all pending approval requests (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getPendingApprovalRequests = async (req, res) => {
  try {
    const userRole = req.user?.role || 'guest';

    // Only admins can view approval requests
    if (userRole !== 'admin') {
      return res.status(403).json(
        standardError("Access denied - only admins can view approval requests", null, 403)
      );
    }

    const approvalRequests = await adminApprovalModel
      .find({ status: 'pending' })
      .sort({ requestedAt: -1 });

    res.json(
      standardSuccess("Pending approval requests retrieved successfully", approvalRequests)
    );
  } catch (error) {
    logger.error("Get pending approval requests error:", error);
    res.status(500).json(
      standardError("Internal server error", error.message, 500)
    );
  }
};

/**
 * Approve a pending request (admin only)
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Approval request ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role || 'guest';
    const adminId = req.user?._id;

    // Only admins can approve requests
    if (userRole !== 'admin') {
      return res.status(403).json(
        standardError("Access denied - only admins can approve requests", null, 403)
      );
    }

    const approvalRequest = await adminApprovalModel.findById(id);
    if (!approvalRequest) {
      return res.status(404).json(
        standardError("Approval request not found", null, 404)
      );
    }

    // Update approval request
    const updatedRequest = await adminApprovalModel.findByIdAndUpdate(
      id,
      {
        status: 'approved',
        approvedBy: adminId,
        approvedAt: new Date()
      },
      { new: true }
    );

    logger.info(`Approval request ${id} approved by admin ${adminId}`);

    res.json(
      standardSuccess("Approval request approved successfully", updatedRequest)
    );
  } catch (error) {
    logger.error("Approve request error:", error);
    res.status(500).json(
      standardError("Internal server error", error.message, 500)
    );
  }
};

/**
 * Reject a pending request (admin only)
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Approval request ID
 * @param {Object} req.body - Request body containing rejection reason
 * @param {string} req.body.rejectionReason - Reason for rejection
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const userRole = req.user?.role || 'guest';
    const adminId = req.user?._id;

    // Only admins can reject requests
    if (userRole !== 'admin') {
      return res.status(403).json(
        standardError("Access denied - only admins can reject requests", null, 403)
      );
    }

    if (!rejectionReason) {
      return res.status(400).json(
        standardError("Rejection reason is required", null, 400)
      );
    }

    const approvalRequest = await adminApprovalModel.findById(id);
    if (!approvalRequest) {
      return res.status(404).json(
        standardError("Approval request not found", null, 404)
      );
    }

    // Update approval request
    const updatedRequest = await adminApprovalModel.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        rejectedBy: adminId,
        rejectedAt: new Date(),
        rejectionReason
      },
      { new: true }
    );

    logger.info(`Approval request ${id} rejected by admin ${adminId}: ${rejectionReason}`);

    res.json(
      standardSuccess("Approval request rejected successfully", updatedRequest)
    );
  } catch (error) {
    logger.error("Reject request error:", error);
    res.status(500).json(
      standardError("Internal server error", error.message, 500)
    );
  }
};

/**
 * Get approval history for a specific user
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.userId - User ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getUserApprovalHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?._id;

    // Users can only view their own approval history, unless they're admins
    const userRole = req.user?.role || 'guest';
    if (userRole !== 'admin' && requestingUserId !== userId) {
      return res.status(403).json(
        standardError("Access denied - you can only view your own approval history", null, 403)
      );
    }

    const approvalHistory = await adminApprovalModel
      .find({ userId })
      .sort({ requestedAt: -1 });

    res.json(
      standardSuccess("User approval history retrieved successfully", approvalHistory)
    );
  } catch (error) {
    logger.error("Get user approval history error:", error);
    res.status(500).json(
      standardError("Internal server error", error.message, 500)
    );
  }
};