import express from "express";
import {
  userAccount,
  userProfile,
  registerUser,
  loginUser,
  guestLogin,
  updateProfile,
  updateStatus,
  updateStatusCustom,
  changePassword,
  getProfile,
  getPublicProfile,
  toggleFollow,
  toggleFriend,
  getDrivers,
  getStores,
  getAllUsers,
  getAdminAllUsers,
  uploadProfileImage,
  uploadAvatarImage,
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  deleteUser,
} from "../controllers/userController.js";

import {
  authMiddleware,
  adminOnly,
  ownerOnly,
  userOrGuest
} from "../middleware/auth.js";

import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

const userRouter = express.Router();

// Authentication
userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/guest-login", guestLogin);

// User account and profile
userRouter.get("/account", authMiddleware, userAccount);
userRouter.get("/profile", authMiddleware, userProfile); // user endpoint to see their profile
//userRouter.get("/menus", authMiddleware({ requireAuth: true }), userMenus); // user endpoint to see their catalog
userRouter.post("/update-profile", authMiddleware, updateProfile);
userRouter.post("/update-status", authMiddleware, updateStatus);
userRouter.post("/update-status-custom", authMiddleware, updateStatusCustom);
//userRouter.post("/update-menu/:menuId", authMiddleware({ requireAuth: true }), updateMenu); // Temporarily disabled
userRouter.post("/change-password", authMiddleware, changePassword);
//// Image uploads
userRouter.post("/upload-profile-image/:targetId", authMiddleware, ownerOnly("targetId"), upload.single("image"), uploadProfileImage);
userRouter.post("/upload-avatar-image/:targetId", authMiddleware, ownerOnly("targetId"), upload.single("image"), uploadAvatarImage);
//// Social features
userRouter.post("/follow", authMiddleware, toggleFollow);
userRouter.post("/friend", authMiddleware, toggleFriend);
//// Favorites
userRouter.post("/favorites/add", authMiddleware, addToFavorites);
userRouter.post("/favorites/remove", authMiddleware, removeFromFavorites);
userRouter.get("/favorites/:userId", authMiddleware, getFavorites);


// Admin routes
userRouter.get("/admin/profile/:targetId", adminOnly , getProfile);
userRouter.delete("/:targetId", adminOnly, deleteUser);
//userRouter.get("/admin/menu/:menuId",adminOnly , getMenu);
//// Driver management
userRouter.get("/admin/drivers", adminOnly, getDrivers);
//// Store management
userRouter.get("/admin/stores", adminOnly, getStores);
//// All users
userRouter.get("/admin/all", adminOnly, getAdminAllUsers);
userRouter.get("/all", authMiddleware({ requireAuth: true }), getAllUsers);

// Public routes
userRouter.get("/public/profile/:targetId", getPublicProfile); // Public endpoint, no auth required, 
//userRouter.get("/public/menu/:menuId", getPublicMenu); // Public endpoint, no auth required, to see user menu


export default userRouter;