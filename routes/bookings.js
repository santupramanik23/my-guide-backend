

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateObjectIdParam } from "../middleware/objectIdParam.js";
import {
  createBooking,
  myBookings,
  getBookingById,
  allBookings,
  updateBookingStatus,
  cancelBooking,
  confirmPayment,
  updateBooking,
  deleteBooking,
  quickUpdateStatus
} from "../controllers/bookingController.js";

const router = Router();

// Create booking
router.post("/", requireAuth, createBooking);

// Get user's bookings
router.get("/my-bookings", requireAuth, myBookings);

// Get all bookings (admin only)
router.get("/", requireAuth, requireRole("admin"), allBookings);

// Get specific booking
router.get("/:id", requireAuth, validateObjectIdParam("id"), getBookingById);

// Update booking status (admin only)
router.patch("/:id/status", requireAuth, requireRole("admin"), validateObjectIdParam("id"), updateBookingStatus);

// Cancel booking
router.patch("/:id/cancel", requireAuth, validateObjectIdParam("id"), cancelBooking);

// Update booking details
router.patch("/:id", requireAuth, validateObjectIdParam("id"), updateBooking);

// Delete booking (soft delete)
router.delete("/:id", requireAuth, validateObjectIdParam("id"), deleteBooking);

// Quick status update
router.patch("/:id/quick-status", requireAuth, validateObjectIdParam("id"), quickUpdateStatus);

// Confirm payment
router.post("/confirm-payment", requireAuth, confirmPayment);

export default router;