import createError from "http-errors";
import { Booking } from "../models/Booking.js";
import { Activity } from "../models/Activity.js";
import { Place } from "../models/Place.js";
import { PRICING, BOOKING } from "../config/constants.js";
import { sendBookingConfirmation, sendCancellationEmail } from "../services/emailService.js";
import { generateBookingReceipt } from "../services/pdfService.js";
import { getRecommendationsForBooking } from "../services/recommendationService.js";

const DEV = process.env.NODE_ENV !== 'production';

// Create Booking
export const createBooking = async (req, res, next) => {
  try {
    if (DEV) console.log("📦 Creating booking for user:", req.user.id);
    
    const body = req.body;
    
    // Validate required fields
    if (!body.date) {
      throw createError(400, "Date is required");
    }
    if (!body.activityId && !body.placeId) {
      throw createError(400, "Either activityId or placeId is required");
    }

    const participants = body.participants || body.peopleCount || 1;
    
    // Calculate pricing
    let totalAmount = body.totalAmount;
    let pricing = body.pricing || {};
    
    if (!totalAmount && (body.activityId || body.placeId)) {
      let item;
      if (body.activityId) {
        item = await Activity.findById(body.activityId);
      } else {
        item = await Place.findById(body.placeId);
      }
      
      if (item) {
        const basePrice = item.price || item.basePrice || PRICING.DEFAULT_BASE_PRICE;
        const subtotal = basePrice * participants;
        const tax = Math.round(subtotal * PRICING.TAX_RATE);
        const serviceFee = Math.round(subtotal * PRICING.SERVICE_FEE_RATE);
        const promoOff = pricing.promoOff || 0;
        totalAmount = Math.max(0, subtotal + tax + serviceFee - promoOff);
        
        pricing = {
          basePrice,
          subtotal,
          tax,
          serviceFee,
          promoOff,
          total: totalAmount,
        };
      }
    }

    // Get customer data
    const customerData = body.customer || (body.participantDetails && body.participantDetails[0]) || {
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone || "",
    };

    const booking = await Booking.create({
      user: req.user.id,
      place: body.placeId,
      activity: body.activityId,
      date: new Date(body.date),
      time: body.time,
      participants,
      peopleCount: participants,
      participantDetails: body.participantDetails || [customerData],
      customer: customerData,
      specialRequests: body.specialRequests || "",
      totalAmount: totalAmount || 0,
      pricing: pricing,
      status: "confirmed",
      paymentStatus: "pending",
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate("place", "name title location city images rating")
      .populate("activity", "title name price basePrice city duration images rating category");

    if (DEV) console.log("✅ Booking created:", populatedBooking._id);

    // Send confirmation email (async, don't wait for it)
    const item = populatedBooking.activity || populatedBooking.place;
    const user = {
      name: customerData.name,
      email: customerData.email
    };

    sendBookingConfirmation(populatedBooking, user, item).catch(err => {
      console.error('Failed to send booking confirmation email:', err);
    });

    res.status(201).json({
      message: "Booking created successfully",
      data: { booking: populatedBooking }
    });
  } catch (err) {
    if (DEV) console.error("❌ Booking creation error:", err);
    next(err);
  }
};

// Get User's Bookings
export const myBookings = async (req, res, next) => {
  try {
    if (DEV) console.log("📋 Fetching bookings for user:", req.user.id);
    
    const bookings = await Booking.find({ user: req.user.id })
      .populate("place", "name title location city images rating")
      .populate("activity", "title name price basePrice city duration images rating category")
      .sort({ createdAt: -1 });

    if (DEV) console.log(`✅ Found ${bookings.length} bookings for user`);

    res.json({ 
      data: { bookings } 
    });
  } catch (err) {
    console.error("❌ Get bookings error:", err);
    next(err);
  }
};

// Get Booking by ID
export const getBookingById = async (req, res, next) => {
  try {
    if (DEV) console.log("🔍 Fetching booking:", req.params.id);
    
    const booking = await Booking.findById(req.params.id)
      .populate("activity", "title name price basePrice city duration images rating category")
      .populate("place", "name title location city images rating")
      .populate("user", "name email phone");

    if (!booking) {
      throw createError(404, "Booking not found");
    }

    if (booking.user._id.toString() !== req.user.id && req.user.role !== "admin") {
      throw createError(403, "Not authorized to view this booking");
    }

    res.json({ 
      data: { booking } 
    });
  } catch (err) {
    console.error("❌ Get booking error:", err);
    next(err);
  }
};

// Get All Bookings (Admin)
export const allBookings = async (req, res, next) => {
  try {
    if (DEV) console.log("👑 Admin fetching all bookings");
    
    const bookings = await Booking.find()
      .populate("user", "name email role")
      .populate("place", "name title")
      .populate("activity", "title name price")
      .sort({ createdAt: -1 });

    res.json({ 
      data: { bookings } 
    });
  } catch (err) {
    console.error("❌ Get all bookings error:", err);
    next(err);
  }
};

// Update Booking Status (Admin)
export const updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["pending", "confirmed", "cancelled", "completed"].includes(status)) {
      throw createError(400, "Invalid status");
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true }
    )
    .populate("activity", "title name")
    .populate("place", "name title");

    if (!booking) {
      throw createError(404, "Booking not found");
    }

    res.json({ 
      message: "Booking status updated successfully", 
      data: { booking } 
    });
  } catch (err) {
    console.error("❌ Update status error:", err);
    next(err);
  }
};

// Cancel Booking
export const cancelBooking = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      throw createError(404, "Booking not found");
    }

    if (booking.user.toString() !== req.user.id && req.user.role !== "admin") {
      throw createError(403, "Not authorized to cancel this booking");
    }

    if (booking.status === "cancelled") {
      throw createError(400, "Booking is already cancelled");
    }

    // Check cancellation time (minimum hours before)
    const bookingDate = new Date(booking.date);
    const now = new Date();
    const hoursDifference = (bookingDate - now) / (1000 * 60 * 60);

    if (hoursDifference < BOOKING.MIN_CANCELLATION_HOURS) {
      throw createError(400, `Cancellation must be done at least ${BOOKING.MIN_CANCELLATION_HOURS} hours before the booking date`);
    }

    booking.status = "cancelled";
    booking.cancellationReason = reason || "Cancelled by user";
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("activity", "title name")
      .populate("place", "name title")
      .populate("user", "name email");

    if (DEV) console.log("✅ Booking cancelled:", booking._id);

    // Send cancellation email (async, don't wait for it)
    const item = populatedBooking.activity || populatedBooking.place;
    const user = populatedBooking.user || {
      name: populatedBooking.customer?.name,
      email: populatedBooking.customer?.email
    };

    sendCancellationEmail(populatedBooking, user, item).catch(err => {
      console.error('Failed to send cancellation email:', err);
    });

    res.json({
      message: "Booking cancelled successfully",
      data: { booking: populatedBooking }
    });
  } catch (err) {
    console.error("❌ Cancel booking error:", err);
    next(err);
  }
};

// Update Booking
export const updateBooking = async (req, res, next) => {
  try {
    const { date, participants, specialRequests } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      throw createError(404, "Booking not found");
    }

    if (booking.user.toString() !== req.user.id) {
      throw createError(403, "Not authorized to update this booking");
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw createError(400, "Can only update pending or confirmed bookings");
    }

    if (date) booking.date = new Date(date);
    if (participants) {
      booking.participants = participants;
      booking.peopleCount = participants;
    }
    if (specialRequests) booking.specialRequests = specialRequests;

    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("activity", "title name price city duration images rating category")
      .populate("place", "name title location city images rating");

    res.json({ 
      message: "Booking updated successfully", 
      data: { booking: populatedBooking } 
    });
  } catch (err) {
    console.error("❌ Update booking error:", err);
    next(err);
  }
};

// Delete Booking
export const deleteBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      throw createError(404, "Booking not found");
    }

    if (booking.user.toString() !== req.user.id && req.user.role !== "admin") {
      throw createError(403, "Not authorized to delete this booking");
    }

    // Only allow deletion of cancelled or past bookings
    const canDelete = booking.status === 'cancelled' || new Date(booking.date) < new Date();
    if (!canDelete) {
      throw createError(400, "Only cancelled or past bookings can be deleted");
    }

    // Soft delete
    booking.deleted = true;
    booking.deletedAt = new Date();
    await booking.save();

    if (DEV) console.log("✅ Booking deleted:", booking._id);

    res.json({ 
      message: "Booking deleted successfully" 
    });
  } catch (err) {
    console.error("❌ Delete booking error:", err);
    next(err);
  }
};

// Quick Status Update
export const quickUpdateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["pending", "confirmed", "cancelled", "completed"].includes(status)) {
      throw createError(400, "Invalid status");
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      throw createError(404, "Booking not found");
    }

    if (booking.user.toString() !== req.user.id && req.user.role !== "admin") {
      throw createError(403, "Not authorized to update this booking");
    }

    // Validate status transition
    const allowedTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    };

    if (!allowedTransitions[booking.status]?.includes(status)) {
      throw createError(400, `Cannot change status from ${booking.status} to ${status}`);
    }

    booking.status = status;
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("activity", "title name")
      .populate("place", "name title");

    res.json({ 
      message: `Booking ${status} successfully`, 
      data: { booking: populatedBooking } 
    });
  } catch (err) {
    console.error("❌ Quick status update error:", err);
    next(err);
  }
};

// Confirm Payment
export const confirmPayment = async (req, res, next) => {
  try {
    const { bookingId, paymentId, amount } = req.body;

    if (!bookingId || !paymentId) {
      throw createError(400, "Booking ID and payment ID are required");
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      throw createError(404, "Booking not found");
    }

    if (booking.user.toString() !== req.user.id) {
      throw createError(403, "Not authorized to confirm payment for this booking");
    }

    booking.status = "confirmed";
    booking.paymentStatus = "paid";
    booking.paymentId = paymentId;
    
    if (amount) {
      booking.totalAmount = amount;
    }
    
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("activity", "title name")
      .populate("place", "name title");

    res.json({
      message: "Payment confirmed successfully",
      data: { booking: populatedBooking }
    });
  } catch (err) {
    console.error("❌ Confirm payment error:", err);
    next(err);
  }
};

// Download Booking Receipt as PDF
export const downloadReceipt = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("user", "name email phone")
      .populate("activity", "title name location price basePrice")
      .populate("place", "name title location price basePrice");

    if (!booking) {
      throw createError(404, "Booking not found");
    }

    // Check authorization
    if (booking.user?._id.toString() !== req.user.id && req.user.role !== "admin") {
      throw createError(403, "Not authorized to download this receipt");
    }

    const item = booking.activity || booking.place;
    const user = booking.user || {
      name: booking.customer?.name,
      email: booking.customer?.email,
      phone: booking.customer?.phone
    };

    if (DEV) console.log("📄 Generating PDF receipt for booking:", booking._id);

    // Generate PDF
    const pdfBuffer = await generateBookingReceipt(booking, user, item);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="booking-receipt-${booking._id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

    if (DEV) console.log("✅ PDF receipt generated successfully");

  } catch (err) {
    console.error("❌ Download receipt error:", err);
    next(err);
  }
};

// Get Recommendations for Booking
export const getBookingRecommendations = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("activity", "title name city category price basePrice images rating duration")
      .populate("place", "title name city location price basePrice images rating");

    if (!booking) {
      throw createError(404, "Booking not found");
    }

    // Check authorization
    if (booking.user.toString() !== req.user.id && req.user.role !== "admin") {
      throw createError(403, "Not authorized to view recommendations for this booking");
    }

    if (DEV) console.log("🎯 Generating recommendations for booking:", booking._id);

    const recommendations = await getRecommendationsForBooking(booking);

    res.json({
      message: "Recommendations retrieved successfully",
      data: recommendations
    });

  } catch (err) {
    console.error("❌ Get recommendations error:", err);
    next(err);
  }
};