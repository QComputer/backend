import groupModel from "../models/groupModel.js";
import userModel from "../models/userModel.js";
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

// Create group
const createGroup = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    // Check if user is admin
    const user = await userModel.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { name, description, isPrivate = false } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }

    const group = new groupModel({
      name: name.trim(),
      description,
      isPrivate,
      createdBy: userId,
      members: [{ user: userId, role: 'admin' }]
    });

    await group.save();

    const populatedGroup = await groupModel.findById(group._id)
      .populate('createdBy', 'username name');

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: populatedGroup
    });
  } catch (error) {
    logger.error('Error creating group:', error);
    res.status(500).json({ success: false, message: "Error creating group" });
  }
};

// Get all groups
const getAllGroups = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    let query = {};
    if (user.role !== 'admin') {
      // Regular users only see public groups
      query.isPrivate = false;
    }

    const groups = await groupModel
      .find(query)
      .populate('createdBy', 'username name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: groups,
      message: "Groups retrieved successfully"
    });
  } catch (error) {
    logger.error('Error fetching all groups:', error);
    res.status(500).json({ success: false, message: "Error fetching groups" });
  }
};

// Get group by ID
const getGroupById = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const { id } = req.params;

    const group = await groupModel.findById(id)
      .populate('createdBy', 'username name')
      .populate('members.user', 'username name');

    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Check if user can access private group
    if (group.isPrivate) {
      const user = await userModel.findById(userId);
      if (!user || user.role !== 'admin') {
        const isMember = group.members.some(member =>
          member.user._id.toString() === userId
        );
        if (!isMember) {
          return res.status(403).json({ success: false, message: "Access denied to private group" });
        }
      }
    }

    res.json({
      success: true,
      data: group,
      message: "Group retrieved successfully"
    });
  } catch (error) {
    logger.error('Error fetching group:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    res.status(500).json({ success: false, message: "Error fetching group" });
  }
};

// Update group
const updateGroup = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    // Check if user is admin
    const user = await userModel.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { id } = req.params;
    const { name, description, isPrivate } = req.body;

    const group = await groupModel.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (name !== undefined) group.name = name;
    if (description !== undefined) group.description = description;
    if (isPrivate !== undefined) group.isPrivate = isPrivate;

    await group.save();

    const populatedGroup = await groupModel.findById(id)
      .populate('createdBy', 'username name');

    res.json({
      success: true,
      message: 'Group updated successfully',
      data: populatedGroup
    });
  } catch (error) {
    logger.error('Error updating group:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    res.status(500).json({ success: false, message: "Error updating group" });
  }
};

// Delete group
const deleteGroup = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    // Check if user is admin
    const user = await userModel.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { id } = req.params;

    const group = await groupModel.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    await groupModel.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting group:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    res.status(500).json({ success: false, message: "Error deleting group" });
  }
};

// Add member to group
const addMember = async (req, res) => {
  try {
    const authenticatedUserId = req.userId; // authenticated user
    if (!authenticatedUserId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    // Check if user is admin
    const user = await userModel.findById(authenticatedUserId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { id } = req.params;
    const memberId = req.userId; // member to add

    const group = await groupModel.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Check if member already exists
    const isMember = group.members.some(member =>
      member.user.toString() === memberId
    );
    if (isMember) {
      return res.status(400).json({ success: false, message: "User is already a member of this group" });
    }

    group.members.push({ user: memberId, role: 'member' });
    await group.save();

    res.json({
      success: true,
      message: 'Member added to group successfully'
    });
  } catch (error) {
    logger.error('Error adding member:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    res.status(500).json({ success: false, message: "Error adding member" });
  }
};

// Remove member from group
const removeMember = async (req, res) => {
  try {
    const authenticatedUserId = req.userId; // authenticated user
    if (!authenticatedUserId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    // Check if user is admin
    const user = await userModel.findById(authenticatedUserId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { id } = req.params;
    const memberId = req.userId; // member to remove

    const group = await groupModel.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Check if member exists
    const memberIndex = group.members.findIndex(member =>
      member.user.toString() === memberId
    );
    if (memberIndex === -1) {
      return res.status(404).json({ success: false, message: "User is not a member of this group" });
    }

    group.members.splice(memberIndex, 1);
    await group.save();

    res.json({
      success: true,
      message: 'Member removed from group successfully'
    });
  } catch (error) {
    logger.error('Error removing member:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    res.status(500).json({ success: false, message: "Error removing member" });
  }
};

export {
  createGroup,
  getAllGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
};