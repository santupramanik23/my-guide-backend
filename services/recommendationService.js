/**
 * Recommendation Service
 * Provides personalized activity/place recommendations based on user bookings
 */

import { Activity } from '../models/Activity.js';
import { Place } from '../models/Place.js';

/**
 * Get recommended activities/places based on a booking
 * Uses location, category, and popularity to suggest similar experiences
 */
export const getRecommendationsForBooking = async (booking) => {
  try {
    const item = booking.activity || booking.place;
    const isActivity = !!booking.activity;

    if (!item) {
      return { activities: [], places: [] };
    }

    // Extract key attributes for recommendations
    const city = item.city || item.location?.city;
    const category = item.category;
    const currentId = item._id;

    const recommendations = {
      activities: [],
      places: []
    };

    // Recommendation Strategy:
    // 1. Same city + same category (most relevant)
    // 2. Same city + different category (explore more in same location)
    // 3. Same category + different city (similar experiences elsewhere)

    if (isActivity) {
      // Get recommended activities
      const query = {
        _id: { $ne: currentId }, // Exclude current item
        $or: [
          // Same city + same category (highest priority)
          { city, category },
          // Same city (medium priority)
          { city },
          // Same category (lower priority)
          { category }
        ]
      };

      recommendations.activities = await Activity.find(query)
        .select('title name city category price basePrice images rating duration')
        .sort({ 'rating.avg': -1, 'rating.count': -1 }) // Sort by rating
        .limit(6)
        .lean();

      // Also recommend nearby places
      if (city) {
        recommendations.places = await Place.find({
          city,
          _id: { $ne: currentId }
        })
          .select('title name city location images rating price basePrice')
          .sort({ 'rating.avg': -1, 'rating.count': -1 })
          .limit(3)
          .lean();
      }
    } else {
      // Get recommended places
      const query = {
        _id: { $ne: currentId },
        $or: [
          { city },
          { 'location.city': city }
        ]
      };

      recommendations.places = await Place.find(query)
        .select('title name city location images rating price basePrice')
        .sort({ 'rating.avg': -1, 'rating.count': -1 })
        .limit(6)
        .lean();

      // Also recommend activities in the same city
      if (city) {
        recommendations.activities = await Activity.find({
          city
        })
          .select('title name city category price basePrice images rating duration')
          .sort({ 'rating.avg': -1, 'rating.count': -1 })
          .limit(3)
          .lean();
      }
    }

    // Deduplicate and prioritize
    const seenIds = new Set();
    const deduplicateAndLimit = (items, limit) => {
      return items
        .filter(item => {
          if (seenIds.has(item._id.toString())) return false;
          seenIds.add(item._id.toString());
          return true;
        })
        .slice(0, limit);
    };

    recommendations.activities = deduplicateAndLimit(recommendations.activities, 4);
    recommendations.places = deduplicateAndLimit(recommendations.places, 2);

    return recommendations;
  } catch (error) {
    console.error('❌ Error generating recommendations:', error);
    return { activities: [], places: [] };
  }
};

/**
 * Get personalized recommendations based on user's booking history
 */
export const getPersonalizedRecommendations = async (userId, limit = 6) => {
  try {
    const { Booking } = await import('../models/Booking.js');

    // Get user's booking history
    const userBookings = await Booking.find({
      user: userId,
      status: { $in: ['confirmed', 'completed'] }
    })
      .populate('activity', 'city category')
      .populate('place', 'city')
      .limit(10)
      .lean();

    if (userBookings.length === 0) {
      // No history - return popular items
      const popularActivities = await Activity.find()
        .select('title name city category price basePrice images rating duration')
        .sort({ 'rating.count': -1, 'rating.avg': -1 })
        .limit(limit)
        .lean();

      return { activities: popularActivities, places: [] };
    }

    // Extract user preferences
    const preferredCities = new Set();
    const preferredCategories = new Set();
    const bookedIds = new Set();

    userBookings.forEach(booking => {
      if (booking.activity) {
        bookedIds.add(booking.activity._id.toString());
        if (booking.activity.city) preferredCities.add(booking.activity.city);
        if (booking.activity.category) preferredCategories.add(booking.activity.category);
      }
      if (booking.place) {
        bookedIds.add(booking.place._id.toString());
        if (booking.place.city) preferredCities.add(booking.place.city);
      }
    });

    // Build recommendation query
    const query = {
      _id: { $nin: Array.from(bookedIds) }, // Exclude already booked
      $or: []
    };

    if (preferredCities.size > 0) {
      query.$or.push({ city: { $in: Array.from(preferredCities) } });
    }

    if (preferredCategories.size > 0) {
      query.$or.push({ category: { $in: Array.from(preferredCategories) } });
    }

    // Fallback to popular if no preferences matched
    if (query.$or.length === 0) {
      delete query.$or;
    }

    const recommendations = await Activity.find(query)
      .select('title name city category price basePrice images rating duration')
      .sort({ 'rating.avg': -1, 'rating.count': -1 })
      .limit(limit)
      .lean();

    return { activities: recommendations, places: [] };
  } catch (error) {
    console.error('❌ Error generating personalized recommendations:', error);
    return { activities: [], places: [] };
  }
};

export default {
  getRecommendationsForBooking,
  getPersonalizedRecommendations
};
