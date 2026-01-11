/**
 * Booking Reminder Cron Job
 * Sends reminder emails 24 hours before bookings
 */

import cron from 'node-cron';
import { Booking } from '../models/Booking.js';
import { sendBookingReminder } from '../services/emailService.js';
import dayjs from 'dayjs';

const DEV = process.env.NODE_ENV !== 'production';

/**
 * Check for bookings that are 24 hours away and send reminders
 */
const sendUpcomingReminders = async () => {
  try {
    if (DEV) console.log('🔔 Running booking reminder check...');

    // Calculate tomorrow at this time (24 hours from now)
    const tomorrow = dayjs().add(24, 'hours');
    const startWindow = tomorrow.subtract(1, 'hour').toDate(); // 23 hours from now
    const endWindow = tomorrow.add(1, 'hour').toDate();         // 25 hours from now

    // Find confirmed bookings in the 24-hour window
    const upcomingBookings = await Booking.find({
      status: 'confirmed',
      date: {
        $gte: startWindow,
        $lte: endWindow
      },
      reminderSent: { $ne: true } // Only bookings that haven't received reminders
    })
    .populate('user', 'name email')
    .populate('activity', 'title name location')
    .populate('place', 'name title location');

    if (DEV) console.log(`📧 Found ${upcomingBookings.length} bookings needing reminders`);

    // Send reminder emails
    for (const booking of upcomingBookings) {
      try {
        const item = booking.activity || booking.place;
        const user = booking.user || {
          name: booking.customer?.name,
          email: booking.customer?.email
        };

        if (user && user.email) {
          await sendBookingReminder(booking, user, item);

          // Mark reminder as sent
          booking.reminderSent = true;
          await booking.save();

          if (DEV) console.log(`✅ Reminder sent for booking: ${booking._id}`);
        }
      } catch (error) {
        console.error(`❌ Failed to send reminder for booking ${booking._id}:`, error);
      }
    }

    if (DEV && upcomingBookings.length > 0) {
      console.log(`✅ Sent ${upcomingBookings.length} reminder emails`);
    }
  } catch (error) {
    console.error('❌ Error in reminder cron job:', error);
  }
};

/**
 * Initialize the cron job
 * Runs every hour to check for bookings needing reminders
 */
export const initReminderCron = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', sendUpcomingReminders);

  console.log('✅ Booking reminder cron job initialized (runs every hour)');

  // Optionally run immediately on startup in development
  if (DEV) {
    console.log('🔄 Running initial reminder check...');
    sendUpcomingReminders();
  }
};

export default initReminderCron;
