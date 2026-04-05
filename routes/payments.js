import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getPaymentById,
  listPayments,
  markPaid,
} from "../controllers/paymentController.js";

const router = Router();

// Create a Razorpay order for a booking (amount taken from DB, not client)
router.post("/create-order", requireAuth, createPaymentOrder);

// Verify Razorpay signature and confirm booking as paid
router.post("/verify", requireAuth, verifyPayment);

// Razorpay webhook — no JWT auth, Razorpay signs the payload itself
router.post("/webhook", handleWebhook);

// List payments
router.get("/", requireAuth, listPayments);

// Get single payment
router.get("/:id", requireAuth, getPaymentById);

// Admin: manually mark paid
router.patch("/:id/mark-paid", requireAuth, requireRole("admin"), markPaid);

export default router;
