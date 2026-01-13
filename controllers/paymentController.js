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
    const { bookingId, amount } = z.object({
      bookingId: z.string(),
      amount: z.number().positive(),
    }).parse(req.body);

    // Verify booking exists and belongs to user
    const booking = await Booking.findById(bookingId)
      .populate("activity", "title name")
      .populate("place", "name title");

    if (!booking) {
      throw createError(404, "Booking not found");
    }

    if (booking.user.toString() !== req.user.id) {
      throw createError(403, "Not authorized to pay for this booking");
    }

    if (booking.paymentStatus === "paid") {
      throw createError(400, "Booking is already paid");
    }

    // Create Razorpay order
    const receipt = `booking_${bookingId}_${Date.now()}`;
    const razorpayOrder = await createOrder({
      amount: Math.round(amount * 100), // Convert to paise
      currency: "INR",
      receipt
    });

    // Create payment record
    const payment = await Payment.create({
      amount,
      currency: "INR",
      provider: "razorpay",
      status: "created",
      providerRef: razorpayOrder.id,
      meta: {
        bookingId,
        receipt,
        razorpayOrderId: razorpayOrder.id
      }
    });

    if (DEV) console.log("💳 Payment order created:", payment._id);

    res.status(201).json({
      message: "Payment order created successfully",
      data: {
        payment,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (err) {
    console.error("❌ Create payment order error:", err);
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
      bookingId: z.string()
    }).parse(req.body);

    // Verify signature
    const isValid = verifySignature({ orderId, paymentId, signature });

    if (!isValid) {
      throw createError(400, "Invalid payment signature");
    }

    // Find payment record
    const payment = await Payment.findOne({ providerRef: orderId });
    if (!payment) {
      throw createError(404, "Payment record not found");
    }

    // Update payment status
    payment.status = "paid";
    payment.meta = {
      ...payment.meta,
      paymentId,
      signature,
      paidAt: new Date()
    };
    await payment.save();

    // Update booking
    const booking = await Booking.findById(bookingId)
      .populate("activity", "title name price basePrice")
      .populate("place", "name title price basePrice")
      .populate("user", "name email");

    if (!booking) {
      throw createError(404, "Booking not found");
    }

    booking.status = "confirmed";
    booking.paymentStatus = "paid";
    booking.paymentId = paymentId;
    await booking.save();

    if (DEV) console.log("✅ Payment verified and booking updated:", bookingId);

    // Send payment confirmation email
    const item = booking.activity || booking.place;
    const user = booking.user || {
      name: booking.customer?.name,
      email: booking.customer?.email
    };

    sendPaymentConfirmation(booking, user, item, payment).catch(err => {
      console.error('Failed to send payment confirmation email:', err);
    });

    res.json({
      message: "Payment verified successfully",
      data: {
        payment,
        booking,
        success: true
      }
    });
  } catch (err) {
    console.error("❌ Verify payment error:", err);
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
