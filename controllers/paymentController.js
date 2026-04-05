import createError from "http-errors";
import { z } from "zod";
import { Payment } from "../models/Payment.js";
import { Booking } from "../models/Booking.js";
import { createOrder, verifySignature } from "../services/paymentService.js";
import { sendPaymentConfirmation } from "../services/emailService.js";

const DEV = process.env.NODE_ENV !== 'production';

/**
 * Create Razorpay order for booking payment
 */
export const createPaymentOrder = async (req, res, next) => {
  try {
    // Accept only bookingId from client — amount comes from DB, never from the client
    const { bookingId } = z.object({
      bookingId: z.string(),
    }).parse(req.body);

    const booking = await Booking.findById(bookingId)
      .populate("activity", "title name")
      .populate("place", "name title");

    if (!booking) throw createError(404, "Booking not found");
    if (booking.user.toString() !== req.user.id)
      throw createError(403, "Not authorized to pay for this booking");
    if (booking.paymentStatus === "paid")
      throw createError(400, "Booking is already paid");
    if (!booking.totalAmount || booking.totalAmount <= 0)
      throw createError(400, "Booking has no payable amount");

    // Amount from the DB — client cannot tamper with the price
    const amountInPaise = Math.round(booking.totalAmount * 100);
    if (amountInPaise < 100) throw createError(400, "Minimum payable amount is ₹1");

    const receipt = `bkg_${bookingId}`;
    const razorpayOrder = await createOrder({
      amount: amountInPaise,
      currency: "INR",
      receipt,
    });

    // Persist the order ID on the booking for signature verification later
    booking.razorpayOrderId = razorpayOrder.id;
    await booking.save();

    // Create a payment record in "created" state
    const payment = await Payment.create({
      amount: booking.totalAmount,
      currency: "INR",
      provider: "razorpay",
      status: "created",
      providerRef: razorpayOrder.id,
      meta: { bookingId, receipt, razorpayOrderId: razorpayOrder.id },
    });

    if (DEV) console.log("💳 Payment order created:", payment._id);

    res.status(201).json({
      message: "Payment order created successfully",
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,   // paise
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    if (DEV) console.error("❌ Create payment order error:", err);
    next(err);
  }
};

/**
 * Verify Razorpay payment and update booking
 */
export const verifyPayment = async (req, res, next) => {
  try {
    const { orderId, paymentId, signature, bookingId } = z.object({
      orderId: z.string(),
      paymentId: z.string(),
      signature: z.string(),
      bookingId: z.string(),
    }).parse(req.body);

    // ── 1. Verify Razorpay HMAC-SHA256 signature ────────────────────────────
    const isValid = verifySignature({ orderId, paymentId, signature });
    if (!isValid) throw createError(400, "Invalid payment signature");

    // ── 2. Load booking and authorise ───────────────────────────────────────
    const booking = await Booking.findById(bookingId)
      .populate("activity", "title name price basePrice")
      .populate("place", "name title price basePrice")
      .populate("user", "name email");

    if (!booking) throw createError(404, "Booking not found");
    if (booking.user._id?.toString() !== req.user.id)
      throw createError(403, "Forbidden");

    // Prevent order-substitution: the orderId must match what we created
    if (booking.razorpayOrderId && booking.razorpayOrderId !== orderId)
      throw createError(400, "Order ID does not match booking");

    // Idempotent: already processed
    if (booking.paymentStatus === "paid") {
      return res.json({
        message: "Payment already recorded",
        data: { bookingId: booking._id, success: true },
      });
    }

    // ── 3. Update booking ───────────────────────────────────────────────────
    booking.status = "confirmed";
    booking.paymentStatus = "paid";
    booking.paymentId = paymentId;
    await booking.save();

    // ── 4. Update payment record ────────────────────────────────────────────
    const payment = await Payment.findOneAndUpdate(
      { providerRef: orderId },
      { status: "paid", $set: { "meta.paymentId": paymentId, "meta.paidAt": new Date() } },
      { new: true }
    );

    if (DEV) console.log("✅ Payment verified, booking confirmed:", bookingId);

    // Fire-and-forget confirmation email
    const item = booking.activity || booking.place;
    const user = booking.user || { name: booking.customer?.name, email: booking.customer?.email };
    sendPaymentConfirmation(booking, user, item, payment).catch(() => {});

    res.json({
      message: "Payment verified successfully",
      data: { bookingId: booking._id, success: true },
    });
  } catch (err) {
    if (DEV) console.error("❌ Verify payment error:", err);
    next(err);
  }
};

/**
 * Handle Razorpay webhook for payment status updates
 */
export const handleWebhook = async (req, res, next) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn("⚠️ Razorpay webhook secret not configured");
      return res.status(200).json({ received: true });
    }

    // Verify webhook signature (you'd implement this similar to payment verification)
    // For now, we'll process the webhook

    const { event, payload } = req.body;

    if (DEV) console.log("📥 Webhook received:", event);

    if (event === "payment.captured") {
      const orderId = payload.payment.entity.order_id;
      const paymentId = payload.payment.entity.id;

      const payment = await Payment.findOne({ providerRef: orderId });

      if (payment && payment.status !== "paid") {
        payment.status = "paid";
        payment.meta = {
          ...payment.meta,
          paymentId,
          webhookProcessedAt: new Date()
        };
        await payment.save();

        // Update associated booking
        if (payment.meta?.bookingId) {
          const booking = await Booking.findById(payment.meta.bookingId);
          if (booking) {
            booking.paymentStatus = "paid";
            booking.status = "confirmed";
            booking.paymentId = paymentId;
            await booking.save();

            if (DEV) console.log("✅ Booking updated via webhook:", booking._id);
          }
        }
      }
    } else if (event === "payment.failed") {
      const orderId = payload.payment.entity.order_id;

      const payment = await Payment.findOne({ providerRef: orderId });
      if (payment) {
        payment.status = "failed";
        payment.meta = {
          ...payment.meta,
          failureReason: payload.payment.entity.error_reason,
          webhookProcessedAt: new Date()
        };
        await payment.save();
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    // Don't call next(err) as webhooks should always return 200
    res.status(200).json({ received: true, error: err.message });
  }
};

/**
 * Get payment details by ID
 */
export const getPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      throw createError(404, "Payment not found");
    }

    // Check if user is authorized (if payment is linked to a booking)
    if (payment.meta?.bookingId) {
      const booking = await Booking.findById(payment.meta.bookingId);
      if (booking && booking.user.toString() !== req.user.id && req.user.role !== "admin") {
        throw createError(403, "Not authorized to view this payment");
      }
    }

    res.json({ data: { payment } });
  } catch (err) {
    next(err);
  }
};

/**
 * List payments (Admin or user's own payments)
 */
export const listPayments = async (req, res, next) => {
  try {
    let query = {};

    // If not admin, only show payments for user's bookings
    if (req.user.role !== "admin") {
      const userBookings = await Booking.find({ user: req.user.id }).select("_id");
      const bookingIds = userBookings.map(b => b._id.toString());
      query = { "meta.bookingId": { $in: bookingIds } };
    }

    const payments = await Payment.find(query).sort({ createdAt: -1 });
    res.json({ data: { payments } });
  } catch (err) {
    next(err);
  }
};

/**
 * Mark payment as paid (Admin only - for manual processing)
 */
export const markPaid = async (req, res, next) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      {
        status: "paid",
        $set: { "meta.manuallyMarkedBy": req.user.id, "meta.manuallyMarkedAt": new Date() }
      },
      { new: true }
    );

    if (!payment) throw createError(404, "Payment not found");

    // Update associated booking if exists
    if (payment.meta?.bookingId) {
      await Booking.findByIdAndUpdate(payment.meta.bookingId, {
        paymentStatus: "paid",
        status: "confirmed"
      });
    }

    res.json({ message: "Payment marked paid", data: { payment } });
  } catch (err) {
    next(err);
  }
};
