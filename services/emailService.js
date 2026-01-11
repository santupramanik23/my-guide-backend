/**
 * Email Service
 * Handles all email sending functionality using Nodemailer
 */

import nodemailer from 'nodemailer';
import dayjs from 'dayjs';

const DEV = process.env.NODE_ENV !== 'production';

// Create reusable transporter
const createTransporter = () => {
  // For development, use ethereal email (fake SMTP)
  // For production, use configured SMTP service

  if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // Fallback for development - log to console
  if (DEV) {
    console.log('⚠️  No email configuration found. Emails will be logged to console.');
  }

  return null;
};

const transporter = createTransporter();

/**
 * Send booking confirmation email
 */
export const sendBookingConfirmation = async (booking, user, item) => {
  if (!transporter) {
    if (DEV) {
      console.log('📧 BOOKING CONFIRMATION EMAIL (simulated)');
      console.log('To:', user.email);
      console.log('Booking ID:', booking._id);
      console.log('Activity:', item.name);
      console.log('Date:', dayjs(booking.date).format('MMMM D, YYYY'));
      console.log('Participants:', booking.participants);
      console.log('Total Price:', `₹${booking.totalPrice}`);
    }
    return;
  }

  const subject = `Booking Confirmed - ${item.name}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
        .booking-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .info-label { font-weight: bold; color: #667eea; }
        .total-row { font-size: 1.2em; font-weight: bold; color: #667eea; padding-top: 15px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Booking Confirmed!</h1>
          <p>Your adventure awaits</p>
        </div>

        <div class="content">
          <p>Hi ${user.name},</p>
          <p>Great news! Your booking has been confirmed. We're excited to have you join us!</p>

          <div class="booking-card">
            <h2 style="color: #667eea; margin-top: 0;">${item.name}</h2>

            <div class="info-row">
              <span class="info-label">Booking ID:</span>
              <span>${booking._id}</span>
            </div>

            <div class="info-row">
              <span class="info-label">Date:</span>
              <span>${dayjs(booking.date).format('MMMM D, YYYY')}</span>
            </div>

            <div class="info-row">
              <span class="info-label">Time:</span>
              <span>${booking.time || 'To be confirmed'}</span>
            </div>

            <div class="info-row">
              <span class="info-label">Participants:</span>
              <span>${booking.participants} ${booking.participants === 1 ? 'person' : 'people'}</span>
            </div>

            <div class="info-row">
              <span class="info-label">Status:</span>
              <span style="color: #10b981; font-weight: bold;">Confirmed</span>
            </div>

            <div class="info-row total-row">
              <span>Total Amount:</span>
              <span>₹${booking.totalPrice}</span>
            </div>
          </div>

          <h3>What's Next?</h3>
          <ul>
            <li>You'll receive a reminder email 24 hours before your booking</li>
            <li>Please arrive 15 minutes early at the meeting point</li>
            <li>Don't forget to bring a valid ID</li>
            ${booking.specialRequests ? `<li>Special requests: ${booking.specialRequests}</li>` : ''}
          </ul>

          ${item.location ? `
            <h3>Location</h3>
            <p>${item.location.address || 'Address will be shared in confirmation'}</p>
          ` : ''}

          <center>
            <a href="${process.env.FRONTEND_URL}/bookings/${booking._id}" class="button">
              View Booking Details
            </a>
          </center>

          <p style="margin-top: 30px; font-size: 0.9em; color: #666;">
            Need to make changes? You can cancel or modify your booking up to 24 hours before the scheduled date.
          </p>
        </div>

        <div class="footer">
          <p>Questions? Contact us at support@myguide.com</p>
          <p>&copy; ${new Date().getFullYear()} My Guide. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"My Guide" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: subject,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (DEV) {
      console.log('✅ Booking confirmation email sent:', info.messageId);
    }
    return info;
  } catch (error) {
    console.error('❌ Error sending booking confirmation email:', error);
    throw error;
  }
};

/**
 * Send booking reminder email (24 hours before)
 */
export const sendBookingReminder = async (booking, user, item) => {
  if (!transporter) {
    if (DEV) {
      console.log('📧 BOOKING REMINDER EMAIL (simulated)');
      console.log('To:', user.email);
      console.log('Reminder for:', item.name);
      console.log('Tomorrow at:', dayjs(booking.date).format('MMMM D, YYYY'));
    }
    return;
  }

  const subject = `Reminder: Your booking tomorrow - ${item.name}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
        .reminder-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .checklist { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .checklist-item { padding: 8px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Reminder: Your booking is tomorrow!</h1>
        </div>

        <div class="content">
          <p>Hi ${user.name},</p>

          <div class="reminder-box">
            <h3 style="margin-top: 0; color: #d97706;">📅 Tomorrow at ${booking.time || 'scheduled time'}</h3>
            <h2 style="margin: 10px 0; color: #333;">${item.name}</h2>
            <p style="margin-bottom: 0;">
              <strong>Date:</strong> ${dayjs(booking.date).format('dddd, MMMM D, YYYY')}<br>
              <strong>Participants:</strong> ${booking.participants} ${booking.participants === 1 ? 'person' : 'people'}<br>
              <strong>Booking ID:</strong> ${booking._id}
            </p>
          </div>

          <div class="checklist">
            <h3 style="margin-top: 0;">✓ Pre-Trip Checklist</h3>
            <div class="checklist-item">☐ Valid ID or passport</div>
            <div class="checklist-item">☐ Booking confirmation (this email)</div>
            <div class="checklist-item">☐ Comfortable clothing and footwear</div>
            <div class="checklist-item">☐ Water bottle</div>
            <div class="checklist-item">☐ Camera (optional)</div>
            ${booking.specialRequests ? `<div class="checklist-item">☐ ${booking.specialRequests}</div>` : ''}
          </div>

          ${item.location ? `
            <h3>📍 Meeting Point</h3>
            <p>${item.location.address || 'Address in booking confirmation'}</p>
            <p style="color: #d97706; font-weight: bold;">Please arrive 15 minutes early</p>
          ` : ''}

          <p style="margin-top: 30px;">
            Looking forward to seeing you tomorrow! If you need to cancel or have any questions,
            please contact us as soon as possible.
          </p>
        </div>

        <div class="footer">
          <p>Questions? Contact us at support@myguide.com</p>
          <p>&copy; ${new Date().getFullYear()} My Guide. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"My Guide" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: subject,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (DEV) {
      console.log('✅ Booking reminder email sent:', info.messageId);
    }
    return info;
  } catch (error) {
    console.error('❌ Error sending booking reminder email:', error);
    throw error;
  }
};

/**
 * Send cancellation confirmation email
 */
export const sendCancellationEmail = async (booking, user, item) => {
  if (!transporter) {
    if (DEV) {
      console.log('📧 CANCELLATION EMAIL (simulated)');
      console.log('To:', user.email);
      console.log('Cancelled:', item.name);
    }
    return;
  }

  const subject = `Booking Cancelled - ${item.name}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Cancelled</h1>
        </div>

        <div class="content">
          <p>Hi ${user.name},</p>
          <p>Your booking has been successfully cancelled.</p>

          <h3>Cancelled Booking Details:</h3>
          <p>
            <strong>Activity:</strong> ${item.name}<br>
            <strong>Date:</strong> ${dayjs(booking.date).format('MMMM D, YYYY')}<br>
            <strong>Booking ID:</strong> ${booking._id}<br>
            <strong>Amount:</strong> ₹${booking.totalPrice}
          </p>

          <p>We're sorry to see this booking cancelled. We hope to see you again soon!</p>

          <p style="margin-top: 30px;">
            Explore more amazing experiences on our platform.
          </p>
        </div>

        <div class="footer">
          <p>Questions? Contact us at support@myguide.com</p>
          <p>&copy; ${new Date().getFullYear()} My Guide. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"My Guide" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: subject,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (DEV) {
      console.log('✅ Cancellation email sent:', info.messageId);
    }
    return info;
  } catch (error) {
    console.error('❌ Error sending cancellation email:', error);
    throw error;
  }
};

export default {
  sendBookingConfirmation,
  sendBookingReminder,
  sendCancellationEmail,
};
