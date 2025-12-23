import messageModel from "../models/messageModel.js";
import userModel from "../models/userModel.js";
import groupModel from "../models/groupModel.js";
import mongoose from "mongoose";
import winston from "winston";

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

// Send message
const sendMessage = async (req, res) => {
  try {
    const userId = req.userId;

    if (!req.authenticated) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const { recipientId, recipientIds, groupId, subject = "Message", content, isUrgent = false } = req.body;

    // Input validation
    if (!content) {
      return res.status(400).json({ success: false, message: "Content is required" });
    }

    if (content.length > 1000) {
      return res.status(400).json({ success: false, message: "Content exceeds maximum length of 1000 characters" });
    }

    if (!groupId && !recipientId && (!recipientIds || recipientIds.length === 0)) {
      return res.status(400).json({ success: false, message: "Either recipientId, recipientIds, or groupId is required" });
    }

    const sender = await userModel.findById(req.userId);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    // Check if it's a group message
    if (groupId) {
      // Group message
      const group = await groupModel.findById(groupId);
      if (!group) {
        return res.status(404).json({ success: false, message: "Group not found" });
      }

      // Check if user is member of the group
      const isMember = group.members.some(member =>
        member.user.toString() === req.userId.toString()
      );
      if (!isMember) {
        return res.status(403).json({ success: false, message: "Not authorized to send messages to this group" });
      }

      const message = new messageModel({
        senderId: userId,
        groupId: groupId,
        subject,
        content,
        isUrgent,
        messageType: 'text'
      });

      await message.save();

      // Populate for response
      const populatedMessage = await messageModel.findById(message._id)
        .populate('senderId', 'username name')
        .populate('groupId', 'name');

      const responseData = {
        _id: populatedMessage._id,
        sender: populatedMessage.senderId,
        group: populatedMessage.groupId,
        subject: populatedMessage.subject,
        content: populatedMessage.content,
        isUrgent: populatedMessage.isUrgent,
        isRead: populatedMessage.isRead,
        timestamp: populatedMessage.timestamp
      };

      res.status(201).json({
        success: true,
        message: 'Group message sent successfully',
        data: responseData
      });
    } else {
      // Handle multiple recipients or single recipient
      const recipients = recipientIds || (recipientId ? [recipientId] : []);
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ success: false, message: "Recipient(s) required for private messages" });
      }

      // Validate all recipients exist
      const recipientUsers = await userModel.find({ _id: { $in: recipients } });
      if (recipientUsers.length !== recipients.length) {
        return res.status(404).json({ success: false, message: "One or more recipients not found" });
      }

      // Send message to each recipient
      const sentMessages = [];
      for (const recId of recipients) {
        const message = new messageModel({
          senderId: userId,
          recipientId: recId,
          subject,
          content,
          isUrgent,
          messageType: 'text'
        });

        await message.save();
        sentMessages.push(message._id);
      }

      // Return response for the first message (for backward compatibility)
      const firstMessage = await messageModel.findById(sentMessages[0])
        .populate('senderId', 'username name')
        .populate('recipientId', 'username name');

      const responseData = {
        _id: firstMessage._id,
        sender: firstMessage.senderId,
        recipient: firstMessage.recipientId,
        subject: firstMessage.subject,
        content: firstMessage.content,
        isUrgent: firstMessage.isUrgent,
        isRead: firstMessage.isRead,
        timestamp: firstMessage.timestamp,
        sentCount: sentMessages.length
      };

      res.status(201).json({
        success: true,
        message: `Message sent to ${sentMessages.length} recipient(s)`,
        data: responseData
      });
    }
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ success: false, message: "Error sending message" });
  }
};

// Get messages between two users
const getMessages = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.userId;

    const messages = await messageModel
      .find({
        $or: [
          { senderId: userId, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: userId }
        ]
      })
      .populate('senderId', 'username name avatar')
      .populate('recipientId', 'username name avatar')
      .sort({ timestamp: 1 });

    // Automatically mark messages as read when user fetches them
    if (req.query.markAsRead !== 'false') {
      await messageModel.updateMany(
        {
          senderId: otherUserId,
          recipientId: userId,
          isRead: false
        },
        {
          $set: {
            isRead: true,
            readAt: new Date()
          },
          $addToSet: {
            readByUsers: userId
          }
        }
      );
    }

    res.json({ success: true, data: messages });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.json({ success: false, message: "Error fetching messages" });
  }
};

// Get group messages
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    const messages = await messageModel
      .find({ groupId })
      .populate('senderId', 'username name avatar')
      .sort({ timestamp: 1 });

    // Automatically mark messages as read when user fetches them
    if (userId && req.query.markAsRead !== 'false') {
      const isMember = await isUserInGroup(userId, groupId);
      if (isMember) {
        await messageModel.updateMany(
          {
            groupId,
            isRead: false,
            readByUsers: { $ne: userId }
          },
          {
            $set: {
              isRead: true,
              readAt: new Date()
            },
            $addToSet: {
              readByUsers: userId
            }
          }
        );
      }
    }

    res.json({ success: true, data: messages });
  } catch (error) {
    logger.error('Error fetching group messages:', error);
    res.json({ success: false, message: "Error fetching group messages" });
  }
};


// Get unread messages
const getUnreadMessages = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId || userId === 'undefined') {
      return res.json({ success: false, message: "Invalid user ID provided" });
    }

    // Get user's groups
    const userGroups = await groupModel.find({ 'members.user': userId }).select('_id');

    const groupIds = userGroups.map(g => g._id);

    // Find messages where user is recipient and hasn't read them, or group messages in user's groups that user hasn't read
    const unreadMessages = await messageModel
      .find({
        $or: [
          {
            recipientId: userId,
            isRead: { $ne: true }
          },
          {
            groupId: { $in: groupIds },
            isRead: { $ne: true },
            readByUsers: { $ne: userId }
          }
        ]
      })
      .populate('senderId', 'username name')
      .populate('groupId', 'name')
      .sort({ timestamp: -1 });

    res.json({ success: true, data: unreadMessages });
  } catch (error) {
    logger.error('Error fetching unread messages:', error);
    res.json({ success: false, message: "Error fetching unread messages" });
  }
};

// Get user conversations
const getConversations = async (req, res) => {
  try {
    const userId = req.userId;

    // Find all unique conversation partners
    const sentMessages = await messageModel.distinct('recipientId', { senderId: userId });
    const receivedMessages = await messageModel.distinct('senderId', {
      recipientId: userId,
      senderId: { $ne: userId }
    });

    const conversationUserIds = [...new Set([...sentMessages, ...receivedMessages])];

    // Get conversation details for each partner
    const conversations = await Promise.all(
      conversationUserIds.map(async (partnerId) => {
        // Get the latest message
        const latestMessage = await messageModel
          .findOne({
            $or: [
              { senderId: userId, recipientId: partnerId },
              { senderId: partnerId, recipientId: userId }
            ]
          })
          .populate('senderId', 'username name avatar')
          .populate('recipientId', 'username name avatar')
          .sort({ timestamp: -1 })
          .limit(1);

        // Count unread messages from this partner
        const unreadCount = await messageModel.countDocuments({
          senderId: partnerId,
          recipientId: userId,
          isRead: { $ne: true }
        });

        // Determine the name and avatar of the conversation partner
        let partnerName = 'Unknown';
        let partnerAvatar = '';
        if (latestMessage?.senderId && latestMessage?.recipientId) {
          const partnerUser = latestMessage.senderId._id.toString() === partnerId.toString()
            ? latestMessage.senderId
            : latestMessage.recipientId;
          partnerName = partnerUser.username || partnerUser.name || 'Unknown';
          partnerAvatar = partnerUser.avatar || '';
        }

        return {
          id: partnerId,
          type: 'private',
          name: partnerName,
          avatar: partnerAvatar,
          participants: [{ _id: partnerId }],
          lastMessage: latestMessage,
          unreadCount
        };
      })
    );

    // Sort by latest message timestamp
    conversations.sort((a, b) => {
      const aTime = a.lastMessage?.timestamp || new Date(0);
      const bTime = b.lastMessage?.timestamp || new Date(0);
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    res.json({ success: true, data: conversations });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.json({ success: false, message: "Error fetching conversations" });
  }
};

// Get all conversations (both private and group) for a user
const getAllConversations = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    if (!userId) {
      return res.json({ success: false, message: "Invalid user ID provided" });
    }

    // Get private conversations
    const sentMessages = await messageModel.distinct('recipientId', { senderId: userId });
    const receivedMessages = await messageModel.distinct('senderId', {
      recipientId: userId,
      senderId: { $ne: userId }
    });

    const privateConversationUserIds = [...new Set([...sentMessages, ...receivedMessages])];

    // Filter out null values and convert to ObjectIds
    const validPrivateConversationUserIds = privateConversationUserIds.filter(id => id != null).map(id => new mongoose.Types.ObjectId(id));

    // Get group conversations
    const userGroups = await groupModel.find({
      'members.user': userId
    }).select('_id name avatar lastMessage updatedAt');

    // Batch fetch all partner users
    const partners = await userModel.find({ _id: { $in: validPrivateConversationUserIds } }).select('name username avatar statusMain');

    // Create a map for quick lookup
    const partnerMap = new Map(partners.map(p => [p._id.toString(), p]));

    // Convert userId to string for proper comparison in aggregation
    const userIdString = userId.toString();

    // Get latest messages for private conversations using aggregation
    const latestMessagesAgg = await messageModel.aggregate([
      {
        $match: {
          $or: [
            { senderId: userId, recipientId: { $in: validPrivateConversationUserIds } },
            { senderId: { $in: validPrivateConversationUserIds }, recipientId: userId }
          ]
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: [{ $toString: "$senderId" }, userIdString] },
              then: { $toString: "$recipientId" },
              else: { $toString: "$senderId" }
            }
          },
          lastMessage: { $first: "$$ROOT" }
        }
      }
    ]);

    // Populate the latest messages with proper execution
    const latestMessageIds = latestMessagesAgg.map(item => item.lastMessage._id);
    const populatedMessages = await messageModel.find({ _id: { $in: latestMessageIds } })
      .populate('senderId', 'username name avatar')
      .populate('recipientId', 'username name avatar')
      .exec();

    const messageMap = new Map(populatedMessages.map(m => [m._id.toString(), m]));

    // Get unread counts for private conversations using aggregation
    const unreadCountsAgg = await messageModel.aggregate([
      {
        $match: {
          senderId: { $in: validPrivateConversationUserIds },
          recipientId: userId,
          isRead: { $ne: true }
        }
      },
      {
        $group: {
          _id: { $toString: "$senderId" },
          count: { $sum: 1 }
        }
      }
    ]);

    const unreadCountMap = new Map(unreadCountsAgg.map(item => [item._id, item.count]));

    // Build private conversations
    const privateConversations = validPrivateConversationUserIds.map(partnerId => {
      const partner = partnerMap.get(partnerId.toString());
      const latestMessageAgg = latestMessagesAgg.find(item => item._id === partnerId.toString());
      const lastMessage = latestMessageAgg ? messageMap.get(latestMessageAgg.lastMessage._id.toString()) : null;
      const unreadCount = unreadCountMap.get(partnerId.toString()) || 0;

      // Ensure lastMessage has proper structure even if null
      const normalizedLastMessage = lastMessage ? {
        _id: lastMessage._id,
        senderId: lastMessage.senderId,
        recipientId: lastMessage.recipientId,
        content: lastMessage.content,
        timestamp: lastMessage.timestamp,
        isRead: lastMessage.isRead,
        readByUsers: lastMessage.readByUsers || [],
        messageType: lastMessage.messageType || 'text'
      } : {
        content: unreadCount > 0 ? 'New messages' : 'No messages yet',
        timestamp: new Date(),
        isRead: true,
        readByUsers: []
      };

      return {
        _id: partnerId,
        type: 'private',
        name: partner?.name || partner?.username || 'Unknown',
        avatar: partner?.avatar || '',
        statusMain: partner?.statusMain || '',
        participants: [{ _id: partnerId }],
        lastMessage: normalizedLastMessage,
        unreadCount,
        updatedAt: lastMessage?.timestamp || new Date(0)
      };
    });

    // Get conversation details for each group
    const groupConversations = await Promise.all(
      userGroups.map(async (group) => {
        // Get the latest message in the group
        const latestMessage = await messageModel
          .findOne({ groupId: group._id })
          .populate('senderId', 'username name avatar')
          .sort({ timestamp: -1 })
          .limit(1);

        // Count unread messages in the group
        const unreadCount = await messageModel.countDocuments({
          groupId: group._id,
          isRead: { $ne: true },
          readByUsers: { $ne: userId }
        });

        // Ensure lastMessage has proper structure even if null
        const normalizedLastMessage = latestMessage ? {
          _id: latestMessage._id,
          senderId: latestMessage.senderId,
          content: latestMessage.content,
          timestamp: latestMessage.timestamp,
          isRead: latestMessage.isRead,
          readByUsers: latestMessage.readByUsers || [],
          messageType: latestMessage.messageType || 'text'
        } : {
          content: unreadCount > 0 ? 'New messages' : 'No messages yet',
          timestamp: new Date(),
          isRead: true,
          readByUsers: []
        };

        return {
          _id: group._id,
          type: 'group',
          name: group.name,
          avatar: group.avatar,
          participants: group.members ? group.members.map(m => ({ _id: m.user })) : [],
          lastMessage: normalizedLastMessage,
          unreadCount,
          updatedAt: group.updatedAt || new Date(0)
        };
      })
    );

    // Combine all conversations
    const allConversations = [...privateConversations, ...groupConversations];

    // Sort by latest message timestamp
    allConversations.sort((a, b) => {
      const aTime = a.updatedAt || new Date(0);
      const bTime = b.updatedAt || new Date(0);
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    // Ensure we always return an array, even if empty
    res.json({
      success: true,
      data: allConversations.length > 0 ? allConversations : []
    });
  } catch (error) {
    logger.error('Error fetching all conversations:', error);
    res.json({
      success: false,
      message: "Error fetching conversations",
      data: [] // Return empty array on error for consistency
    });
  }
};


// Get single message by ID
const getMessageById = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const { id } = req.params;

    const message = await messageModel.findById(id)
      .populate('senderId', 'username')
      .populate('recipientId', 'username');

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Check if user has access to this message
    if (message.senderId._id.toString() !== userId && message.recipientId._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to access this message" });
    }

    res.json({
      success: true,
      data: message,
      message: "Message retrieved successfully"
    });
  } catch (error) {
    logger.error('Error fetching message:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    res.status(500).json({ success: false, message: "Error retrieving message" });
  }
};

// Mark message as read
const markMessageAsRead = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const { id } = req.params;

    const message = await messageModel.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Check if user has access to this message (recipient for private messages, member for group messages)
    const hasAccess = message.recipientId?.toString() === userId ||
                     (message.groupId && await isUserInGroup(userId, message.groupId));

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Unauthorized to mark this message as read" });
    }

    // Update the read status
    message.isRead = true;
    message.readAt = new Date();

    // Update readByUsers array
    if (!message.readByUsers) {
      message.readByUsers = [];
    }

    const alreadyInReadByUsers = message.readByUsers.some(id => id.toString() === userId);
    if (!alreadyInReadByUsers) {
      message.readByUsers.push(userId);
    }

    await message.save();

    const populatedMessage = await messageModel.findById(id)
      .populate('senderId', 'username')
      .populate('recipientId', 'username')
      .populate('groupId', 'name');

    res.json({
      success: true,
      message: "Message marked as read",
      data: populatedMessage
    });
  } catch (error) {
    logger.error('Error marking message as read:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    res.status(500).json({ success: false, message: "Error marking message as read" });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const { id } = req.params;

    const message = await messageModel.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Check if user has access (sender or recipient can delete)
    if (message.senderId.toString() !== userId && message.recipientId.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this message" });
    }

    await messageModel.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Message deleted successfully"
    });
  } catch (error) {
    logger.error('Error deleting message:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    res.status(500).json({ success: false, message: "Error deleting message" });
  }
};

// Search messages
const searchMessages = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const { query, isUrgent } = req.query;

    let searchQuery = { recipientId: userId }; // Search in inbox by default

    // Add search query if provided - search in subject field
    if (query) {
      searchQuery.subject = { $regex: query, $options: 'i' };
    }

    // Filter by urgency if specified
    if (isUrgent !== undefined) {
      searchQuery.isUrgent = isUrgent === 'true';
    }

    const messages = await messageModel.find(searchQuery)
      .sort({ timestamp: -1 })
      .populate('senderId', 'username');

    res.json({
      success: true,
      data: messages,
      message: "Message search completed successfully"
    });
  } catch (error) {
    logger.error('Error searching messages:', error);
    res.status(500).json({ success: false, message: "Error searching messages" });
  }
};

// Helper function to check if user is in group
const isUserInGroup = async (userId, groupId) => {
  const group = await groupModel.findById(groupId);
  if (!group) return false;

  return group.members.some(member =>
    member.user.toString() === userId.toString()
  );
};

// Mark multiple messages as read (bulk operation)
const markMessagesAsRead = async (req, res) => {
  try {
    const { messageIds } = req.body;
    const userId = req.userId;

    if (!userId || userId === 'undefined') {
      return res.json({ success: false, message: "Invalid user ID provided" });
    }

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.json({ success: false, message: "Message IDs array is required" });
    }

    // Update all messages at once
    const result = await messageModel.updateMany(
      {
        _id: { $in: messageIds },
        $or: [
          { recipientId: userId },
          { groupId: { $exists: true } }
        ]
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        },
        $addToSet: {
          readByUsers: userId
        }
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} messages marked as read`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    logger.error('Error marking messages as read:', error);
    res.json({ success: false, message: "Error marking messages as read" });
  }
};

export {
  sendMessage,
  getMessages,
  getGroupMessages,
  getConversations,
  getAllConversations,
  getUnreadMessages,
  markMessagesAsRead,
  getMessageById,
  markMessageAsRead,
  deleteMessage,
  searchMessages,
};