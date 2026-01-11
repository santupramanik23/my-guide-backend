/**
 * Application Constants
 *
 * Centralized configuration for magic numbers and constants
 */

// ========================
// Pricing Configuration
// ========================
export const PRICING = {
  TAX_RATE: 0.18,           // 18% tax
  SERVICE_FEE_RATE: 0.05,   // 5% service fee
  DEFAULT_BASE_PRICE: 99,   // Default price if not set
};

// ========================
// Booking Configuration
// ========================
export const BOOKING = {
  MIN_CANCELLATION_HOURS: 24,     // Minimum hours before booking to cancel
  MAX_PARTICIPANTS: 50,            // Maximum participants per booking
  MIN_PARTICIPANTS: 1,             // Minimum participants per booking
};

// ========================
// File Upload Limits
// ========================
export const UPLOAD = {
  AVATAR_MAX_SIZE: 2 * 1024 * 1024,       // 2MB for avatars
  IMAGE_MAX_SIZE: 10 * 1024 * 1024,       // 10MB for content images
  MAX_IMAGES_PER_ITEM: 10,                // Max images per activity/place
  MAX_TAGS_PER_ITEM: 20,                  // Max tags per activity/place
};

// ========================
// Pagination Defaults
// ========================
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 1000,
};

// ========================
// User Roles
// ========================
export const ROLES = {
  TRAVELLER: 'traveller',
  GUIDE: 'guide',
  INSTRUCTOR: 'instructor',
  ADVISOR: 'advisor',
  ADMIN: 'admin',
};

export const PUBLIC_ROLES = [
  ROLES.TRAVELLER,
  ROLES.GUIDE,
  ROLES.INSTRUCTOR,
  ROLES.ADVISOR,
];

// ========================
// Status Values
// ========================
export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded',
  FAILED: 'failed',
};

// ========================
// Time Configuration
// ========================
export const TIME = {
  ONE_MINUTE_MS: 60 * 1000,
  ONE_HOUR_MS: 60 * 60 * 1000,
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
  ONE_WEEK_MS: 7 * 24 * 60 * 60 * 1000,
};

// ========================
// Cache Configuration
// ========================
export const CACHE = {
  MAX_AGE_STATIC: 0,              // Cache-Control max-age for API responses
  MUST_REVALIDATE: true,          // Cache-Control must-revalidate
};
