import commentModel from "../models/commentModel.js";
import winston from "winston";

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

// Add comment
const addComment = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const { productId, text, rating } = req.body;

    if (!productId || !text) {
      return res.status(400).json({ success: false, message: "Product ID and text are required" });
    }

    const comment = new commentModel({
      user: userId,
      product: productId,
      text,
      rating: rating || 0
    });

    await comment.save();

    const populatedComment = await commentModel.findById(comment._id)
      .populate('user', 'username name');

    const responseData = {
      _id: populatedComment._id,
      user: populatedComment.user._id,
      product: populatedComment.product,
      text: populatedComment.text,
      rating: populatedComment.rating,
      createdAt: populatedComment.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: responseData
    });
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ success: false, message: "Error adding comment" });
  }
};

// Get comments for product
const getProductComments = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const { productId } = req.params;

    const comments = await commentModel
      .find({ product: productId })
      .populate('user', 'username name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: comments,
      message: "Comments retrieved successfully"
    });
  } catch (error) {
    logger.error('Error fetching product comments:', error);
    res.status(500).json({ success: false, message: "Error fetching comments" });
  }
};

// Get comments by user
const getUserComments = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const { userId: targetUserId } = req.params;

    const comments = await commentModel
      .find({ user: targetUserId })
      .populate('user', 'username name')
      .populate('product', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: comments,
      message: "User comments retrieved successfully"
    });
  } catch (error) {
    logger.error('Error fetching user comments:', error);
    res.status(500).json({ success: false, message: "Error fetching comments" });
  }
};

// Update comment
const updateComment = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const { id } = req.params;
    const { text, rating } = req.body;

    let comment;
    try {
      comment = await commentModel.findById(id);
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(404).json({ success: false, message: "Comment not found" });
      }
      throw error;
    }

    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    if (comment.user.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to update this comment" });
    }

    if (text !== undefined) comment.text = text;
    if (rating !== undefined) comment.rating = rating;

    await comment.save();

    const populatedComment = await commentModel.findById(id)
      .populate('user', 'username name');

    res.json({
      success: true,
      message: 'Comment updated successfully',
      data: populatedComment
    });
  } catch (error) {
    logger.error('Error updating comment:', error);
    res.status(500).json({ success: false, message: "Error updating comment" });
  }
};

// Delete comment
const deleteComment = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const { id } = req.params;

    let comment;
    try {
      comment = await commentModel.findById(id);
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(404).json({ success: false, message: "Comment not found" });
      }
      throw error;
    }

    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    if (comment.user.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this comment" });
    }

    await commentModel.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting comment:', error);
    res.status(500).json({ success: false, message: "Error deleting comment" });
  }
};

export {
  addComment,
  getProductComments,
  getUserComments,
  updateComment,
  deleteComment,
};