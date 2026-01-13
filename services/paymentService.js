/**
 * Payment Service
 * Handles Razorpay payment gateway integration
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';

const DEV = process.env.NODE_ENV !== 'production';

// Initialize Razorpay instance with error handling
let razorpayInstance = null;

const initializeRazorpay = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    if (DEV) {
      console.warn('⚠️  Razorpay credentials not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');
    }
    return null;
  }

  try {
    return new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  } catch (error) {
    console.error('❌ Failed to initialize Razorpay:', error);
    return null;
  }
};

razorpayInstance = initializeRazorpay();

/**
 * Create a Razorpay order
 */
export const createOrder = async ({ amount, currency = 'INR', receipt }) => {
  if (!razorpayInstance) {
    throw new Error('Razorpay not configured. Please add credentials to environment variables.');
  }

  try {
    const options = {
      amount: Math.round(amount), // Ensure whole number (paise)
      currency,
      receipt,
      payment_capture: 1, // Auto-capture payment
    };

    const order = await razorpayInstance.orders.create(options);

    if (DEV) {
      console.log('✅ Razorpay order created:', order.id, '- Amount:', INR(amount / 100));
    }

    return order;
  } catch (error) {
    console.error('❌ Error creating Razorpay order:', error);
    throw new Error(`Failed to create payment order: ${error.message}`);
  }
};

/**
 * Verify Razorpay payment signature
 */
export const verifySignature = ({ orderId, paymentId, signature }) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    console.error('❌ Razorpay key secret not configured');
    return false;
  }

  try {
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === signature;

    if (DEV) {
      console.log(isValid ? '✅ Payment signature verified' : '❌ Invalid payment signature');
    }

    return isValid;
  } catch (error) {
    console.error('❌ Error verifying payment signature:', error);
    return false;
  }
};

/**
 * Verify webhook signature
 */
export const verifyWebhookSignature = (webhookBody, webhookSignature) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    if (DEV) {
      console.warn('⚠️  Razorpay webhook secret not configured (allowing in dev mode)');
    }
    return true; // Allow webhook in development
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookBody)
      .digest('hex');

    return expectedSignature === webhookSignature;
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return false;
  }
};

/**
 * Fetch payment details from Razorpay
 */
export const fetchPayment = async (paymentId) => {
  if (!razorpayInstance) {
    throw new Error('Razorpay not configured');
  }

  try {
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('❌ Error fetching payment:', error);
    throw new Error(`Failed to fetch payment: ${error.message}`);
  }
};

/**
 * Create a refund for a payment
 */
export const createRefund = async (paymentId, amount = null) => {
  if (!razorpayInstance) {
    throw new Error('Razorpay not configured');
  }

  try {
    const options = amount ? { amount: Math.round(amount) } : {};
    const refund = await razorpayInstance.payments.refund(paymentId, options);

    if (DEV) {
      console.log('✅ Refund created:', refund.id);
    }

    return refund;
  } catch (error) {
    console.error('❌ Error creating refund:', error);
    throw new Error(`Failed to create refund: ${error.message}`);
  }
};

/**
 * Check if Razorpay is configured
 */
export const isRazorpayConfigured = () => {
  return razorpayInstance !== null;
};

// Helper function for formatting (internal use)
const INR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(n || 0));

export default {
  createOrder,
  verifySignature,
  verifyWebhookSignature,
  fetchPayment,
  createRefund,
  isRazorpayConfigured,
};
