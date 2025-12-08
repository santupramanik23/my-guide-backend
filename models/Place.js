

import mongoose from "mongoose";

export const PLACE_CATEGORIES = [
  "cultural",
  "nature",
  "art",
  "spiritual",
  "food",
  "entertainment",
  "shopping",
  "historical",
  "architectural",
];

const placeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "" },

    category: {
      type: String,
      enum: PLACE_CATEGORIES,
      required: true,
      index: true,
    },
    featured: { type: Boolean, default: false, index: true },

    city: { type: String, trim: true, index: true },
    country: { type: String, trim: true, index: true },

    location: {
      type: { type: String, enum: ["Point"], required: true, default: "Point" },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
        validate: {
          validator(v) {
            return (
              Array.isArray(v) &&
              v.length === 2 &&
              v[0] >= -180 &&
              v[0] <= 180 &&
              v[1] >= -90 &&
              v[1] <= 90
            );
          },
          message: "location.coordinates must be [lng, lat] within valid ranges",
        },
      },
    },

    images: [{ type: String }],
    tags: [{ type: String, index: true }],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

placeSchema.index({ location: "2dsphere" });
placeSchema.index({ city: 1, country: 1 });
placeSchema.index({ category: 1, featured: 1 });
placeSchema.index({ featured: 1, isActive: 1 });

placeSchema.pre("save", function (next) {
  if (Array.isArray(this.tags)) {
    this.tags = this.tags
      .map((t) => (typeof t === "string" ? t.trim().toLowerCase() : t))
      .filter(Boolean);
  }
  next();
});

placeSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Place = mongoose.model("Place", placeSchema);