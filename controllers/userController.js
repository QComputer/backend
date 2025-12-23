import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";
import categoryModel from "../models/categoryModel.js";
import invitationModel from "../models/invitationModel.js";
import socialModel from "../models/socialModel.js";

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import winston from "winston";
import mongoose from "mongoose";
import { uploadImageToServer } from "../utils/imageUpload.js";
import {
  validateUserRegistration,
  validateUserUpdate,
  validateObjectId,
  validateRequired,
  validateRequestBody,
  sanitizeInput,
  createErrorResponse,
  createSuccessResponse
} from "../utils/validation.js";
// Using built-in fetch from Node.js 18+

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

const createToken = (id, role) => {
  if (!id) {
    throw new Error('User ID is required for token generation');
  }
  if (!role) {
    throw new Error('User role is required for token generation');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.sign({ id, role }, process.env.JWT_SECRET);
};

// Shared utility for uploading profile/avatar images
const uploadUserImage = async (req, res, imageType, fieldName) => {
  try {
    const { targetId } = req.params;
    const userId = req.userId; // Use authenticated user ID
    console.log(`=== UPLOAD ${imageType.toUpperCase()} START ===`);
    console.log(`Upload ${imageType} - userId: ${userId}, targetId: ${targetId}, field: ${fieldName}`);

    const user = await userModel.findById(userId);
    if (!user) {
      console.log(`User not found: ${userId}`);
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.role !== "admin" && userId !== targetId) {
      console.log(`Unauthorized access: user ${userId} trying to modify ${targetId}`);
      return res.status(403).json({ success: false, message: "Unauthorized access" });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const targetUser = await userModel.findById(targetId);
    if (!targetUser) {
      console.log(`Target user not found: ${targetId}`);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let imageUrl = '';
    try {
      imageUrl = await uploadImageToServer(req.file.buffer, req.file.originalname, req.file.mimetype);
    } catch (uploadError) {
      console.log(`=== ${imageType.toUpperCase()} SERVICE FALLBACK ===`);
      console.log(`Image service unavailable (${uploadError.message}), using data URL fallback`);
      // Fallback: save to local disc
      const base64 = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
      imageUrl = dataUrl;
      console.log(`Data URL created for ${imageType}: ${dataUrl.substring(0, 50)}...`);
    }

    // Update the appropriate user field
    const updateData = {
      [fieldName]: imageUrl,
      updatedAt: Date.now(),
    };

    await userModel.findByIdAndUpdate(targetId, updateData);

    console.log(`=== UPLOAD ${imageType.toUpperCase()} SUCCESS ===`);
    logger.info(`${imageType} image updated for user: ${targetId}`);
    res.json({
      success: true,
      message: `${imageType} image uploaded successfully`,
      data: {
        url: imageUrl,
      },
    });
  } catch (error) {
    console.log(`=== UPLOAD ${imageType.toUpperCase()} FAILED ===`);
    logger.error(`${imageType} image upload error:`, error);
    res.status(500).json({
      success: false,
      message: `Error uploading ${imageType.toLowerCase()} image`,
      error: error.message,
    });
  }
};

const createUser = async (username, password, role) => {
  try {
    const exists = await userModel.findOne({ username, role });
    if (exists) {
      const message = role + ' "' + username + '" already exists!';
      logger.warn(message);
      return {
        success: false,
        message,
      };
    }
    if (password.length < 6) {
      return {
        success: false,
        message: "Please enter a password with at least 6 characters",
      };
    }
    // hashing user password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new userModel({
      username: username,
      password: hashedPassword,
      role: role,
      statusMain: "online",
    });
    await newUser.save();
    logger.info(
      `User created: ${newUser.username} (${newUser.role}) with main status: ${newUser.statusMain}`
    );
    return newUser;
  } catch (error) {
    logger.error("Error creating user:", error);
  }
};

const createUserWithInvitation = async (userData, session = null) => {
  try {
    const { username, password, role, storeId, invitationToken, invitationType, invitedBy } = userData;

    const exists = await userModel.findOne({ username, role }).session(session || null);
    if (exists) {
      const message = role + ' "' + username + '" already exists!';
      logger.warn(message);
      return {
        success: false,
        message,
      };
    }
    if (password.length < 6) {
      return {
        success: false,
        message: "Please enter a password with at least 6 characters",
      };
    }
    // hashing user password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new userModel({
      username: username,
      password: hashedPassword,
      role: role,
      statusMain: "online",
      ...(storeId && { storeId }),
      ...(invitationToken && { invitationToken }),
      ...(invitationType && { invitationType }),
      ...(invitedBy && { invitedBy })
    });

    await newUser.save({ session });
    logger.info(
      `User created with invitation: ${newUser.username} (${newUser.role}) with main status: ${newUser.statusMain}`
    );
    return newUser;
  } catch (error) {
    logger.error("Error creating user with invitation:", error);
    throw error;
  }
};

const registerUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let { username, password, role, invitationToken } = req.body;

    // Check if invitation token is provided
    let invitation = null;
    let prefilledRole = role;
    let storeId = null;

    if (invitationToken) {
      // Validate invitation token
      invitation = await invitationModel.findOne({ token: invitationToken }).session(session);

      if (!invitation) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid invitation token"
        });
      }

      // Check if invitation has expired
      if (invitation.expiresAt < new Date()) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invitation has expired"
        });
      }

      // Check if invitation has been used
      if (invitation.isUsed) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invitation has already been used"
        });
      }

      // Pre-fill role and store from invitation
      prefilledRole = invitation.type;
      storeId = invitation.storeId;

      logger.info(`Registration with invitation: ${invitation.type} for store ${storeId}`);
    }

    // Validate request body (role is optional if invitation is provided)
    if (!invitationToken) {
      validateRequestBody(req, ['username', 'password', 'role']);
    } else {
      validateRequestBody(req, ['username', 'password']);
    }

    // Sanitize inputs
    username = sanitizeInput(username);
    password = password; // Don't sanitize password
    role = prefilledRole || sanitizeInput(role);

    // Validate user data
    validateUserRegistration({ username, password, role });

    // Create user with invitation data
    const userData = {
      username,
      password,
      role,
      ...(storeId && { storeId }),
      ...(invitation && {
        invitationToken: invitation.token,
        invitationType: invitation.type,
        invitedBy: invitation.createdBy
      })
    };

    const user = await createUserWithInvitation(userData, session);
    if (user.success === false) {
      await session.abortTransaction();
      const errorResponse = createErrorResponse(user.message, 200);
      return res.status(errorResponse.statusCode).json(errorResponse.response);
    }

    // Mark invitation as used
    if (invitation) {
      await invitationModel.findByIdAndUpdate(invitation._id, {
        isUsed: true,
        usedBy: user._id,
        usedAt: new Date()
      }, { session });

      // For customer invitations, automatically follow the marketer
      if (invitation.type === 'customer') {
        // Create following relationship
        const following = new socialModel({
          userId: user._id,
          targetUserId: storeId,
          relationshipType: 'following'
        });

        // Create follower relationship for store
        const follower = new socialModel({
          userId: storeId,
          targetUserId: user._id,
          relationshipType: 'follower'
        });

        await following.save({ session });
        await follower.save({ session });

        logger.info(`Customer ${user._id} automatically followed store ${storeId}`);
      }
    }

    await session.commitTransaction();

    const token = createToken(user._id, user.role);
    const successResponse = createSuccessResponse({
      token,
      role: user.role,
      username: user.username,
      userId: user._id,
    }, "User registered successfully", 200);
    res.status(successResponse.statusCode).json(successResponse.response);
  } catch (error) {
    await session.abortTransaction();
    logger.error("Error registering user:", error);
    const errorResponse = createErrorResponse(error.message || "Registration failed", 200);
    res.status(errorResponse.statusCode).json(errorResponse.response);
  } finally {
    session.endSession();
  }
};

// login user
const loginUser = async (req, res) => {
  logger.info("Login attempt for user: " + req.body.username);

  const { username, password, role } = req.body;

  try {
    // Find user by username and optionally by role
    const query = role ? { username, role } : { username };
    logger.info(`Login query: ${JSON.stringify(query)}`);
    const user = await userModel.findOne(query);

    if (!user) {
      const message = role
        ? `User with username "${username}" and role "${role}" does not exist`
        : `User with username "${username}" does not exist`;
      logger.warn(message);
      return res.json({ success: false, message });
    }

    logger.info(`User found: ${user.username} (${user.role})`);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn(`Failed login attempt for user: ${username} - invalid password`);
      return res.json({ success: false, message: "Invalid credentials" });
    }

    // Import cart controller for migration
    const { migrateGuestCart } = await import('../controllers/cartController.js');

    // Check if this is a guest migrating to authenticated user
    const sessionId = req.headers['x-session-id'] || req.cookies?.guest_session;

    if (sessionId) {
      logger.info(`🔄 Migrating guest cart for session ${sessionId} to user ${user._id}`);
      try {
        await migrateGuestCart(sessionId, user._id);
        logger.info('✅ Guest cart migration completed successfully');
      } catch (migrationError) {
        logger.error('❌ Guest cart migration failed:', migrationError.message);
        // Don't fail login if migration fails
      }
    }

    const token = createToken(user._id, user.role);
    logger.info(`Token generated for user: username=${user.username}, userId=${user._id}`);

    const responseData = {
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          role: user.role,
          username: user.username,
          name: user.name || '',
          statusMain: user.statusMain,
          statusCustom: user.statusCustom,
          avatar: user.avatar || '',
          image: user.image || ''
        },
        // Clear guest session info since user is now authenticated
        isGuest: false,
        migratedFromGuest: !!sessionId
      }
    };

    // Clear guest session cookie
    res.clearCookie('guest_session');

    logger.info(`Login successful for user: ${user.username}`);
    res.json(responseData);
  } catch (error) {
    logger.error("Error logging in user:", error);
    res.json({ success: false, message: `Error: ${error.message}`, error });
  }
};

// Guest login - creates a temporary guest user with session management
const guestLogin = async (req, res) => {
  logger.info("Guest login attempt");

  try {
    // Check if this is a manual guest login or automatic session creation
    const isManualLogin = req.body?.manualLogin || false;

    // Import session model
    const sessionModel = (await import('../models/sessionModel.js')).default;

    // Check for existing guest session
    let existingSession = null;
    const sessionId = req.headers['x-session-id'] || req.cookies?.guest_session;

    if (sessionId) {
      existingSession = await sessionModel.findByToken(sessionId);
    }

    // If we have a valid existing session and this is automatic, reuse it
    if (!isManualLogin && existingSession && !existingSession.isExpired()) {
      logger.info(`Reusing existing guest session: ${existingSession.sessionId}`);

      // Extend session expiration
      await existingSession.extend();

      const responseData = {
        success: true,
        data: {
          token: existingSession.token,
          user: {
            _id: existingSession.sessionId, // Use session ID as user ID for guests
            role: 'guest',
            username: `guest_${existingSession.sessionId.substring(0, 8)}`,
            name: '',
            statusMain: 'online',
            statusCustom: '',
            avatar: '',
            image: ''
          },
          isGuest: true,
          sessionId: existingSession.sessionId
        }
      };

      return res.json(responseData);
    }

    // Generate a unique username for the guest
    const guestUsername = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const guestPassword = `temp_${Math.random().toString(36).substr(2, 16)}`;

    // Create a temporary guest user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(guestPassword, salt);

    const guestUser = new userModel({
      username: guestUsername,
      password: hashedPassword,
      role: 'guest',
      statusMain: 'online',
    });

    await guestUser.save();

    // Create session for the guest user
    const session = await sessionModel.createGuestSession({
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer']
    });

    const token = createToken(guestUser._id, 'guest');
    logger.info(`Guest user created and logged in: username=${guestUser.username}, userId=${guestUser._id}`);

    const responseData = {
      success: true,
      data: {
        token,
        user: {
          _id: guestUser._id,
          role: 'guest',
          username: guestUser.username,
          name: '',
          statusMain: 'online',
          statusCustom: '',
          avatar: '',
          image: ''
        },
        isGuest: true,
        sessionId: session.sessionId
      }
    };

    logger.info(`Guest login successful for user: ${guestUser.username}`);
    res.json(responseData);
  } catch (error) {
    logger.error("Error creating guest user:", error);
    res.json({ success: false, message: `Error: ${error.message}`, error });
  }
};

// Get user account from owner (requires authentication)
const userAccount = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error("Error fetching user account:", error);
    res.status(500).json({ success: false, message: `Error: ${error.message}`, error: error.message });
  }
};
// Get profile from owner
const userProfile = async (req, res) => {
  try {
    const targetId = req.userId; // Own profile

    const targetUser = await userModel
      .findById(targetId)
      .select("-password");

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // fetching product list
    const products = await productModel.find({ store: targetUser._id });
    // fetching order list
    const orders = await orderModel.find({ store: targetUser._id });
    // fetching category list
    const categories = await categoryModel.find({ store: targetUser._id });

    res.json({ success: true, data: { user: targetUser, products, orders, categories } });
  } catch (error) {
    logger.error("Error fetching user profile:", error);
    res.status(500).json({ success: false, message: "Error fetching user profile", error: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const userId = req.userId;
    validateObjectId(userId, 'User ID');

    const { updatedStatusMain } = req.body;
    if (!updatedStatusMain) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    await userModel.findByIdAndUpdate(userId, { statusMain: updatedStatusMain });
    const updatedUser = await userModel.findById(userId).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    logger.error("Error updating status:", error);
    res.status(500).json({ success: false, message: "Error updating status", error: error.message });
  }
};
const updateStatusCustom = async (req, res) => {
  try {
    const userId = req.userId;
    validateObjectId(userId, 'User ID');
    await userModel.findByIdAndUpdate(userId, { statusCustom: req.statusCustom });
    const updatedUser = await userModel.findById(userId).select("-password");
    res.json({ success: true, data: updatedUser })
    
  } catch (error) {
    console.log(error);
  }
};
// Update user profile from owner (requires authentication)
const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    validateObjectId(userId, 'User ID');

    const {
      name,
      phone,
      email,
      moreInfo,
      statusMain,
      statusCustom,
      avatar,
      image,
      locationLat,
      locationLng,
      shareLocation,
    } = req.body;

    // Validate user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User does not exist" });
    }

    // Validate update data
    const updateFields = { name, phone, email };
    validateUserUpdate(updateFields);

    // Sanitize inputs
    const updateData = { updatedAt: Date.now() };

    if (name !== undefined) updateData.name = sanitizeInput(name);
    if (phone !== undefined) updateData.phone = sanitizeInput(phone);
    if (email !== undefined) updateData.email = sanitizeInput(email);
    if (moreInfo !== undefined) updateData.moreInfo = sanitizeInput(moreInfo);
    if (statusMain !== undefined) updateData.statusMain = sanitizeInput(statusMain);
    if (statusCustom !== undefined) updateData.statusCustom = sanitizeInput(statusCustom);
    if (avatar !== undefined) updateData.avatar = avatar;
    if (image !== undefined) updateData.image = image;
    if (locationLat !== undefined) updateData.locationLat = locationLat;
    if (locationLng !== undefined) updateData.locationLng = locationLng;
    if (shareLocation !== undefined) updateData.shareLocation = shareLocation;

    await userModel.findByIdAndUpdate(userId, updateData);
    const updatedUser = await userModel.findById(userId).select("-password");

    logger.info(`Profile updated for user: ${userId}`);
    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    logger.error("Error updating profile:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error updating profile"
    });
  }
};


// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Both current and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User does not exist" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
      updatedAt: Date.now(),
    });

    logger.info(`Password changed for user: ${userId}`);
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    logger.error("Error changing password:", error);
    res.status(500).json({ success: false, message: "Error changing password", error: error.message });
  }
};

// Get profile by admin
const getProfile = async (req, res) => {
  try {
    const adminId = req.userId;
    const { targetId } = req.params;

    // Validate admin
    const admin = await userModel.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized admin request",
      });
    }

    if (!targetId || targetId === "undefined" || targetId === "null") {
      return res.status(400).json({
        success: false,
        message: "'id' not provided as param",
      });
    }

    const user = await userModel
      .findById(targetId)
      .select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // If user doesn't share location, remove location data from response
    if (!user.shareLocation) {
      user.locationLat = undefined;
      user.locationLng = undefined;
    }

    // fetching product list
    const products = await productModel.find({ store: user._id });
    // fetching order list
    const orders = await orderModel.find({ store: user._id });
    const categories = await categoryModel.find({ store: user._id });

    res.json({ success: true, data: { user, products, orders, categories } });
  } catch (error) {
    logger.error("Error fetching user profile:", error);
    res.status(500).json({ success: false, message: "Error fetching user profile", error: error.message });
  }
};


// Get public profile (no authentication required)
const getPublicProfile = async (req, res) => {
  try {
    let { targetId } = req.params;

    // Validate userId
    if (!targetId || targetId === "undefined" || targetId === "null") {
      return res.json({
        success: false,
        message: "Invalid user ID provided",
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.json({ success: false, message: "Invalid user ID format" });
    }

    const user = await userModel
      .findById(targetId)
      .select("-password");

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.role == "store") {
      // fetching product list
      const products = await productModel.find({ store: user._id });
      // fetching category list
      const categories = await categoryModel.find({ store: user._id });
      res.json({ success: true, data: user, products: products, categories: categories });
    } else {
      res.json({ success: true, data: user });
    }
  } catch (error) {
    logger.error("Error fetching user profile:", error);
    res.json({ success: false, message: "Error fetching user profile", error });
  }
};



// Get all drivers
const getDrivers = async (req, res) => {
  try {
    const drivers = await userModel
      .find({ role: "driver" })
      .select("-password -cartData")
      .sort({ username: 1 });

    res.json({ success: true, data: drivers });
  } catch (error) {
    logger.error("Error fetching drivers:", error);
    res.json({ success: false, message: "Error fetching drivers", error });
  }
};

// Get all stores
const getStores = async (req, res) => {
  try {
    const stores = await userModel
      .find({ role: "store" })
      .select("-password -cartData")
      .sort({ username: 1 });

    res.json({ success: true, data: stores });
  } catch (error) {
    logger.error("Error fetching stores:", error);
    res.json({ success: false, message: "Error fetching stores", error });
  }
};

// Get all users
const getAllCustomers = async (req, res) => {
  try {
    const users = await userModel
      .find({ role: "customer" })
      .select("-password -cartData")
      .sort({ username: 1 })
      .limit(1000);

    logger.info(`Fetched ${users.length} users`);
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error("Error fetching all users:", error);
    res.json({ success: false, message: "Error fetching all users", error });
  }
};

// Get all users (accessible by admin only )
const getAllGuests = async (req, res) => {
  try {
    const adminId = req.body.userId;
    const admin = await userModel.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return res.json({ success: false, message: "Unauthorized access" });
    }
    const users = await userModel.find({ role: "guest" }).sort({ username: 1 });

    logger.info(`Fetched ${users.length} users`);
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error("Error fetching all users:", error);
    res.json({ success: false, message: "Error fetching all users", error });
  }
};

// Get all users
const getAdminAllUsers = async (req, res) => {
  try {
    const users = await userModel
      .find({})
      .select("-password -cartData")
      .sort({ role: 1, username: 1 })
      .limit(1000);

    logger.info(`Fetched ${users.length} users`);
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error("Error fetching all users:", error);
    res.status(500).json({ success: false, message: "Error fetching all users", error: error.message });
  }
};
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel
      .find({role: 'store'})
      .select("-password -cartData")
      .sort({ role: 1, username: 1 })
      .limit(1000);

    logger.info(`Fetched ${users.length} users`);
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error("Error fetching all users:", error);
    res.status(500).json({ success: false, message: "Error fetching all users", error: error.message });
  }
};

// Upload profile image
const uploadProfileImage = async (req, res) => {
  await uploadUserImage(req, res, "Profile", "image");
};

// Upload avatar image
const uploadAvatarImage = async (req, res) => {
  await uploadUserImage(req, res, "Avatar", "avatar");
};

// Add product to favorites
const addToFavorites = async (req, res) => {
  try {
    const { productId, userId: bodyUserId } = req.body;
    // Use authenticated user ID, but allow override from body for backward compatibility
    const userId = bodyUserId || req.userId;

    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const isFavorite = user.favorites.includes(productId);

    if (isFavorite) {
      return res.json({ success: true, message: "Product already in favorites" });
    }

    await userModel.findByIdAndUpdate(userId, {
      $addToSet: { favorites: productId },
      updatedAt: Date.now()
    });

    res.json({ success: true, message: "Product added to favorites" });
  } catch (error) {
    logger.error('Error adding to favorites:', error);
    res.status(500).json({ success: false, message: "Error adding to favorites", error: error.message });
  }
};

// Remove product from favorites
const removeFromFavorites = async (req, res) => {
  try {
    const { productId, userId: bodyUserId } = req.body;
    // Use authenticated user ID, but allow override from body for backward compatibility
    const userId = bodyUserId || req.userId;

    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await userModel.findByIdAndUpdate(userId, {
      $pull: { favorites: productId },
      updatedAt: Date.now()
    });

    res.json({ success: true, message: "Product removed from favorites" });
  } catch (error) {
    logger.error('Error removing from favorites:', error);
    res.status(500).json({ success: false, message: "Error removing from favorites", error: error.message });
  }
};

// Get user's favorites
const getFavorites = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = await userModel.findById(userId).populate('favorites');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: user.favorites });
  } catch (error) {
    logger.error('Error getting favorites:', error);
    res.status(500).json({ success: false, message: "Error getting favorites", error: error.message });
  }
};

// Toggle follow/unfollow a user
const toggleFollow = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.userId;

    if (!targetUserId || !userId) {
      return res.status(400).json({ success: false, message: "User IDs are required" });
    }

    if (userId.toString() === targetUserId.toString()) {
      return res.status(400).json({ success: false, message: "Cannot follow yourself" });
    }

    // Check if already following
    const existingFollow = await socialModel.findOne({
      userId,
      targetUserId,
      relationshipType: 'following'
    });

    if (existingFollow) {
      // Unfollow
      await socialModel.deleteOne({
        userId,
        targetUserId,
        relationshipType: 'following'
      });

      await socialModel.deleteOne({
        userId: targetUserId,
        targetUserId: userId,
        relationshipType: 'follower'
      });

      logger.info(`User ${userId} unfollowed ${targetUserId}`);
      res.json({ success: true, message: "User unfollowed successfully", action: "unfollow" });
    } else {
      // Follow
      const following = new socialModel({
        userId,
        targetUserId,
        relationshipType: 'following'
      });

      const follower = new socialModel({
        userId: targetUserId,
        targetUserId: userId,
        relationshipType: 'follower'
      });

      await following.save();
      await follower.save();

      logger.info(`User ${userId} followed ${targetUserId}`);
      res.json({ success: true, message: "User followed successfully", action: "follow" });
    }
  } catch (error) {
    logger.error('Error toggling follow:', error);
    res.status(500).json({ success: false, message: "Error toggling follow", error: error.message });
  }
};

// Toggle add/remove friend
const toggleFriend = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.userId;

    if (!targetUserId || !userId) {
      return res.status(400).json({ success: false, message: "User IDs are required" });
    }

    if (userId.toString() === targetUserId.toString()) {
      return res.status(400).json({ success: false, message: "Cannot friend yourself" });
    }

    // Check if already friends
    const existingFriend = await socialModel.findOne({
      userId,
      targetUserId,
      relationshipType: 'friend'
    });

    if (existingFriend) {
      // Remove friend
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
      res.json({ success: true, message: "Friend removed successfully", action: "remove" });
    } else {
      // Add friend
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
      res.json({ success: true, message: "Friend added successfully", action: "add" });
    }
  } catch (error) {
    logger.error('Error toggling friend:', error);
    res.status(500).json({ success: false, message: "Error toggling friend", error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const adminId = req.userId;
    const { targetId } = req.params;

    // Validate admin
    const admin = await userModel.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized admin request",
      });
    }

    if (!targetId || targetId === "undefined" || targetId === "null") {
      return res.status(400).json({
        success: false,
        message: "'id' not provided as param",
      });
    }

    const user = await userModel.findById(targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Prevent admin from deleting themselves
    if (adminId === targetId) {
      return res.status(400).json({ success: false, message: "Admin cannot delete themselves" });
    }

    // Delete user
    await userModel.findByIdAndDelete(targetId);

    logger.info(`User deleted by admin: ${adminId} deleted ${targetId}`);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    logger.error("Error deleting user:", error);
    res.status(500).json({ success: false, message: "Error deleting user", error: error.message });
  }
};

export {
  userAccount,
  userProfile,
  createToken,
  createUser,
  registerUser,
  loginUser,
  guestLogin,
  updateProfile,
  updateStatusCustom,
  updateStatus,
  changePassword,
  getProfile,
  getPublicProfile,
  getDrivers,
  getStores,
  getAllUsers,
  getAdminAllUsers,
  uploadProfileImage,
  uploadAvatarImage,
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  toggleFollow,
  toggleFriend,
  deleteUser,
};

