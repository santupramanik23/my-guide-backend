import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    place: { type: mongoose.Schema.Types.ObjectId, ref: "Place", index: true },      // either place or activity
    activity: { type: mongoose.Schema.Types.ObjectId, ref: "Activity", index: true },// either activity or place
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", index: true },  // link to booking
    rating: { type: Number, min: 1, max: 5, required: true, index: true },
    comment: { type: String, default: "" },
    title: { type: String, default: "" },  // Review title/summary
    helpful: { type: Number, default: 0 },  // Helpful votes count
    verified: { type: Boolean, default: false },  // Verified booking
  },
  { timestamps: true }
);

// Useful indexes; keep non-unique to avoid conflicts unless you want to restrict to 1 review per pair
reviewSchema.index({ user: 1, place: 1 });
reviewSchema.index({ user: 1, activity: 1 });

reviewSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Review = mongoose.model("Review", reviewSchema);
