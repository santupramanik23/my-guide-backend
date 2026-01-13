import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateObjectIdParam } from "../middleware/objectIdParam.js";
import {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getPaymentById,
  listPayments,
  markPaid
} from "../controllers/paymentController.js";

const r = Router();

// Create Razorpay order for booking payment
r.post("/create-order", requireAuth, createPaymentOrder);

// Verify payment after successful Razorpay checkout
r.post("/verify", requireAuth, verifyPayment);

// Razorpay webhook endpoint (no auth - Razorpay sends the webhook)
r.post("/webhook", handleWebhook);

// Get payment by ID
r.get("/:id", requireAuth, validateObjectIdParam("id"), getPaymentById);

// List payments (admin or user's own)
r.get("/", requireAuth, listPayments);

// Mark payment as paid (admin only - for manual processing)
r.patch("/:id/paid", requireAuth, requireRole("admin"), validateObjectIdParam("id"), markPaid);

export default r;
