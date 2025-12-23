import socialModel from "../models/socialModel.js";
import userModel from "../models/userModel.js";
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

// Follow a user
const followUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.userId;

    // Check if already following
    const existingFollow = await socialModel.findOne({
      userId,
      targetUserId,
      relationshipType: 'following'
    });

    if (existingFollow) {
      return res.json({ success: false, message: "Already following this user" });
    }

    // Create following relationship
    const following = new socialModel({
      userId,
      targetUserId,
      relationshipType: 'following'
    });

    // Create follower relationship for target user
    const follower = new socialModel({
      userId: targetUserId,
      targetUserId: userId,
      relationshipType: 'follower'
    });

    await following.save();
    await follower.save();

    logger.info(`User ${userId} followed ${targetUserId}`);
    res.json({ success: true, message: "User followed successfully" });
  } catch (error) {
    logger.error('Error following user:', error);
    res.json({ success: false, message: "Error following user" });
  }
};

// Unfollow a user
const unfollowUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.userId;

    // Remove following relationship
    await socialModel.deleteOne({
      userId,
      targetUserId,
      relationshipType: 'following'
    });

    // Remove follower relationship
    await socialModel.deleteOne({
      userId: targetUserId,
      targetUserId: userId,
      relationshipType: 'follower'
    });

    logger.info(`User ${userId} unfollowed ${targetUserId}`);
    res.json({ success: true, message: "User unfollowed successfully" });
  } catch (error) {
    logger.error('Error unfollowing user:', error);
    res.json({ success: false, message: "Error unfollowing user" });
  }
};

// Add friend
const addFriend = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.userId;

    // Check if already friends
    const existingFriend = await socialModel.findOne({
      userId,
      targetUserId,
      relationshipType: 'friend'
    });

    if (existingFriend) {
      return res.json({ success: false, message: "Already friends with this user" });
    }

    // Create friend relationship (bidirectional)
    const friend1 = new socialModel({
      userId,
      targetUserId,
      relationshipType: 'friend'
    });

    const friend2 = new socialModel({
      userId: targetUserId,
      targetUserId: userId,
      relationshipType: 'friend'
    });

    await friend1.save();
    await friend2.save();

    logger.info(`User ${userId} added ${targetUserId} as friend`);
    res.json({ success: true, message: "Friend added successfully" });
  } catch (error) {
    logger.error('Error adding friend:', error);
    res.json({ success: false, message: "Error adding friend" });
  }
};

// Remove friend
const removeFriend = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.userId;

    // Remove friend relationships (bidirectional)
    await socialModel.deleteOne({
      userId,
      targetUserId,
      relationshipType: 'friend'
    });

    await socialModel.deleteOne({
      userId: targetUserId,
      targetUserId: userId,
      relationshipType: 'friend'
    });

    logger.info(`User ${userId} removed ${targetUserId} as friend`);
    res.json({ success: true, message: "Friend removed successfully" });
  } catch (error) {
    logger.error('Error removing friend:', error);
    res.json({ success: false, message: "Error removing friend" });
  }
};

// Get user's social relationships
const getSocialRelationships = async (req, res) => {
  try {
    const userId = req.userId;

    const relationships = await socialModel.find({
      $or: [
        { userId },
        { targetUserId: userId }
      ]
    }).populate('userId', 'username name role avatar')
      .populate('targetUserId', 'username name role avatar')
      .sort({ createdAt: -1 });

    // Organize by type
    const organized = {
      friends: [],
      following: [],
      followers: []
    };

    relationships.forEach(rel => {
      if (rel.relationshipType === 'friend' && rel.userId._id.toString() === userId) {
        organized.friends.push(rel.targetUserId);
      } else if (rel.relationshipType === 'following' && rel.userId._id.toString() === userId) {
        organized.following.push(rel.targetUserId);
      } else if (rel.relationshipType === 'follower' && rel.targetUserId._id.toString() === userId) {
        organized.followers.push(rel.userId);
      }
    });

    // Remove duplicates
    organized.friends = [...new Set(organized.friends.map(f => f._id.toString()))].map(id =>
      organized.friends.find(f => f._id.toString() === id)
    );
    organized.following = [...new Set(organized.following.map(f => f._id.toString()))].map(id =>
      organized.following.find(f => f._id.toString() === id)
    );
    organized.followers = [...new Set(organized.followers.map(f => f._id.toString()))].map(id =>
      organized.followers.find(f => f._id.toString() === id)
    );

    res.json({ success: true, data: organized });
  } catch (error) {
    logger.error('Error fetching social relationships:', error);
    res.json({ success: false, message: "Error fetching social relationships" });
  }
};

// Check relationship status between two users
const getRelationshipStatus = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const userId = req.userId;

    if (!userId || !targetUserId) {
      return res.json({ success: false, message: "User IDs are required" });
    }

    if (userId.toString() === targetUserId.toString()) {
      return res.json({ success: false, message: "Cannot check relationship with yourself" });
    }

    const relationships = await socialModel.find({
      $or: [
        { userId, targetUserId, relationshipType: { $in: ['friend', 'following'] } },
        { userId: targetUserId, targetUserId: userId, relationshipType: 'follower' }
      ]
    });

    const status = {
      isFriend: relationships.some(r => r.relationshipType === 'friend'),
      isFollowing: relationships.some(r => r.relationshipType === 'following' && r.userId.toString() === userId),
      isFollower: relationships.some(r => r.relationshipType === 'follower' && r.userId.toString() === targetUserId),
      isBlocked: relationships.some(r => r.status === 'blocked'),
      relationshipCount: relationships.length
    };

    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Error checking relationship status:', error);
    res.json({ success: false, message: "Error checking relationship status" });
  }
};

// Get mutual friends between two users
const getMutualFriends = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const userId = req.userId;

    if (!userId || !targetUserId) {
      return res.json({ success: false, message: "User IDs are required" });
    }

    // Get user1's friends
    const user1Friends = await socialModel.find({
      userId,
      relationshipType: 'friend'
    }).select('targetUserId');

    // Get user2's friends
    const user2Friends = await socialModel.find({
      userId: targetUserId,
      relationshipType: 'friend'
    }).select('targetUserId');

    // Find intersection (mutual friends)
    const user1FriendIds = user1Friends.map(f => f.targetUserId.toString());
    const user2FriendIds = user2Friends.map(f => f.targetUserId.toString());

    const mutualFriendIds = user1FriendIds.filter(id => user2FriendIds.includes(id));

    // Get user details for mutual friends
    const mutualFriends = await userModel.find({
      _id: { $in: mutualFriendIds }
    }).select('username name avatar');

    res.json({
      success: true,
      data: mutualFriends,
      count: mutualFriends.length
    });
  } catch (error) {
    logger.error('Error fetching mutual friends:', error);
    res.json({ success: false, message: "Error fetching mutual friends" });
  }
};

// Get suggested friends based on social graph
const getFriendSuggestions = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.json({ success: false, message: "User ID is required" });
    }

    // Get user's current friends
    const currentFriends = await socialModel.find({
      userId,
      relationshipType: 'friend'
    }).select('targetUserId');

    const friendIds = currentFriends.map(f => f.targetUserId.toString());
    friendIds.push(userId.toString()); // Don't suggest yourself

    // Get friends of friends (2nd degree connections)
    const friendsOfFriends = await socialModel.aggregate([
      {
        $match: {
          targetUserId: { $in: currentFriends.map(f => f.targetUserId) },
          relationshipType: 'friend'
        }
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          _id: { $nin: friendIds.map(id => new mongoose.Types.ObjectId(id)) }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Get user details for suggestions
    const suggestionIds = friendsOfFriends.map(f => f._id);
    const suggestions = await userModel.find({
      _id: { $in: suggestionIds }
    }).select('username name avatar');

    res.json({
      success: true,
      data: suggestions,
      count: suggestions.length
    });
  } catch (error) {
    logger.error('Error fetching friend suggestions:', error);
    res.json({ success: false, message: "Error fetching friend suggestions" });
  }
};

export {
  followUser,
  unfollowUser,
  addFriend,
  removeFriend,
  getSocialRelationships,
  getRelationshipStatus,
  getMutualFriends,
  getFriendSuggestions
};