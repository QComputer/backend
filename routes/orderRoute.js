import express from "express";
import {
  placeOrder,
  acceptOrderByStore,
  rejectOrderByStore,
  cancelOrder,
  prepareOrder,
  pickupOrder,
  acceptOrderByDriver,
  userOrders,
  driverOrders,
  storeOrders,
  getPendingOrders,
  allOrders,
  receiveOrderByCustomer,
  deliverOrderByDriver,
  getAvailableOrdersForDriver,
  adjustPreparationTime,
  adjustPickupTime,
  adjustDeliveryTime,
  updateOrderProgress,
  getOrdersProgress,
  addCustomerFeedback,
  getStoreOrderCounts,
  getDashboardStatistics,
  markOrderAsPaid,
  markOrderAsUnpaid,
} from "../controllers/orderController.js";
import {authMiddleware, storeOnly, userOrGuest, driverOnly, adminOnly, guestOnly} from "../middleware/auth.js";

const orderRouter = express.Router();
orderRouter.post("/place", userOrGuest, placeOrder);
orderRouter.get("/guest-orders", guestOnly, getGuestOrders);
orderRouter.post("/cancel-guest", guestOnly, cancelGuestOrder);
orderRouter.post("/accept-store", storeOnly, acceptOrderByStore);
orderRouter.post("/reject-store", storeOnly, rejectOrderByStore);
orderRouter.post("/cancel", userOrGuest, cancelOrder);
orderRouter.post("/prepare", storeOnly, prepareOrder);
orderRouter.post("/pickup", driverOnly, pickupOrder);
orderRouter.post("/accept-driver", driverOnly, acceptOrderByDriver);
orderRouter.post("/deliver-driver", driverOnly, deliverOrderByDriver);
orderRouter.post("/receive-customer", userOrGuest, receiveOrderByCustomer);
orderRouter.post("/feedback", userOrGuest, addCustomerFeedback);

orderRouter.post("/adjust-preparation", storeOnly, adjustPreparationTime);
orderRouter.post("/adjust-pickup", driverOnly, adjustPickupTime);
orderRouter.post("/adjust-delivery", driverOnly, adjustDeliveryTime);

orderRouter.get("/progress/:orderId", userOrGuest, updateOrderProgress);
orderRouter.post("/progress-batch", userOrGuest, getOrdersProgress);

orderRouter.get("/user-orders", userOrGuest, userOrders);
orderRouter.post("/driver-orders", driverOnly, driverOrders);
orderRouter.post("/store-orders", storeOnly, storeOrders);
orderRouter.post("/store-counts", storeOnly, getStoreOrderCounts);
orderRouter.get("/pending", userOrGuest, getPendingOrders);
orderRouter.get("/all", userOrGuest, allOrders);
orderRouter.get("/dashboard-stats", userOrGuest, getDashboardStatistics);
orderRouter.post("/available-driver", driverOnly, getAvailableOrdersForDriver);

// Payment endpoints
orderRouter.post("/mark-paid", userOrGuest, markOrderAsPaid);
orderRouter.post("/mark-unpaid", adminOnly, markOrderAsUnpaid);

export default orderRouter;