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
import {unifiedAuth, storeOwnerOnly, userOrGuest, driverOnly} from "../middleware/auth.js";

const orderRouter = express.Router();
orderRouter.post("/place", userOrGuest, placeOrder);
orderRouter.post("/accept-store", storeOwnerOnly, acceptOrderByStore);
orderRouter.post("/reject-store", unifiedAuth, rejectOrderByStore);
orderRouter.post("/cancel", unifiedAuth, cancelOrder);
orderRouter.post("/prepare", unifiedAuth, prepareOrder);
orderRouter.post("/pickup", unifiedAuth, pickupOrder);
orderRouter.post("/accept-driver", unifiedAuth, acceptOrderByDriver);
orderRouter.post("/deliver-driver", unifiedAuth, deliverOrderByDriver);
orderRouter.post("/receive-customer", unifiedAuth, receiveOrderByCustomer);
orderRouter.post("/feedback", unifiedAuth, addCustomerFeedback);

orderRouter.post("/adjust-preparation", unifiedAuth, adjustPreparationTime);
orderRouter.post("/adjust-pickup", unifiedAuth, adjustPickupTime);
orderRouter.post("/adjust-delivery", unifiedAuth, adjustDeliveryTime);

orderRouter.get("/progress/:orderId", unifiedAuth, updateOrderProgress);
orderRouter.post("/progress-batch", unifiedAuth, getOrdersProgress);

orderRouter.get("/user-orders", userOrGuest, userOrders);
orderRouter.post("/driver-orders", driverOnly, driverOrders);
orderRouter.post("/store-orders", unifiedAuth, storeOrders);
orderRouter.post("/store-counts", unifiedAuth, getStoreOrderCounts);
orderRouter.get("/pending", unifiedAuth, getPendingOrders);
orderRouter.get("/all", unifiedAuth, allOrders);
orderRouter.get("/dashboard-stats", unifiedAuth, getDashboardStatistics);
orderRouter.post("/available-driver", unifiedAuth, getAvailableOrdersForDriver);

// Payment endpoints
orderRouter.post("/mark-paid", unifiedAuth, markOrderAsPaid);
orderRouter.post("/mark-unpaid", unifiedAuth, markOrderAsUnpaid);

export default orderRouter;