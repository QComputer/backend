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
  unifiedAuth,
  adminOnly,
  ownerOnly
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
userRouter.get("/account", unifiedAuth, userAccount);
userRouter.get("/profile", unifiedAuth, userProfile); // user endpoint to see their profile
//userRouter.get("/menus", unifiedAuth, userMenus); // user endpoint to see their catalog
userRouter.post("/update-profile", unifiedAuth, updateProfile);
userRouter.post("/update-status", unifiedAuth, updateStatus);
userRouter.post("/update-status-custom", unifiedAuth, updateStatusCustom);
//userRouter.post("/update-menu/:menuId", unifiedAuth, updateMenu); // Temporarily disabled
userRouter.post("/change-password", unifiedAuth, changePassword);
//// Image uploads
userRouter.post("/upload-profile-image/:targetId", unifiedAuth, ownerOnly("targetId"), upload.single("image"), uploadProfileImage);
userRouter.post("/upload-avatar-image/:targetId", unifiedAuth, ownerOnly("targetId"), upload.single("image"), uploadAvatarImage);
//// Social features
userRouter.post("/follow", unifiedAuth, toggleFollow);
userRouter.post("/friend", unifiedAuth, toggleFriend);
//// Favorites
userRouter.post("/favorites/add", unifiedAuth, addToFavorites);
userRouter.post("/favorites/remove", unifiedAuth, removeFromFavorites);
userRouter.get("/favorites/:userId", unifiedAuth, getFavorites);


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
userRouter.get("/all", unifiedAuth, getAllUsers);

// Public routes
userRouter.get("/public/profile/:targetId", getPublicProfile); // Public endpoint, no auth required, 
//userRouter.get("/public/menu/:menuId", getPublicMenu); // Public endpoint, no auth required, to see user menu


export default userRouter;