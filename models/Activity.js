import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true, maxlength: 100 },
    place: { type: mongoose.Schema.Types.ObjectId, ref: "Place", required: true, index: true },

    price: { type: Number, required: true, min: 0, max: 50000 },
    durationMinutes: { type: Number, default: 60, min: 15, max: 1440 },
    description: { type: String, default: "", maxlength: 2000 },

    category: {
      type: String,
      enum: [
        "cultural",
        "nature",
        "art",
        "spiritual",
        "food",
        "adventure",
        "entertainment",
        "shopping",
        "fun",
        "games",
        "sports",
        "historical"
      ],
      index: true,
      required: true,
    },

    featured: { type: Boolean, default: false, index: true },
    isPublished: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: true, index: true },

    capacity: { type: Number, min: 1, max: 100, default: 20 },

    // Keep images as strings (URLs)
    images: [{ type: String }],

    tags: [{ type: String, index: true, maxlength: 50 }],

    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    totalReviews: { type: Number, default: 0 },
  },
  { timestamps: true }
);
// Indexes
activitySchema.index({ place: 1, isActive: 1, isPublished: 1 });
activitySchema.index({ category: 1, featured: 1 });
activitySchema.index({ price: 1, durationMinutes: 1 });
activitySchema.index({ averageRating: -1 });

// Text search index
activitySchema.index({
  title: "text",
  description: "text",
  tags: "text",
});
activitySchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Activity = mongoose.model("Activity", activitySchema);
