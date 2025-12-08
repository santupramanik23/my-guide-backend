import createError from "http-errors";
import { z } from "zod";
import { Place, PLACE_CATEGORIES } from "../models/Place.js";
import { Activity } from "../models/Activity.js";

const zCategory = z
  .enum(PLACE_CATEGORIES, {
    errorMap: () => ({ message: "category must be one of: " + PLACE_CATEGORIES.join(", ") }),
  })
  .optional()
  .default("cultural"); // make required if you want to enforce selection

const createPlaceSchema = z
  .object({
    name: z.string().trim().min(2, "name must be at least 2 chars").max(100),
    description: z.string().max(2000).optional().default(""),
    category: zCategory,
    city: z.string().max(100).optional().default(""),
    country: z.string().max(100).optional().default(""),
    featured: z.coerce.boolean().optional().default(false),
    tags: z
      .union([z.array(z.string().min(1).max(50)), z.string().min(1).max(50)])
      .optional()
      .transform((v) => (Array.isArray(v) ? v : v ? [v] : []))
      .refine((arr) => arr.length <= 20, "tags must be <= 20"),
    images: z
      .union([z.array(z.string().min(1)), z.string().min(1)])
      .optional()
      .transform((v) => (Array.isArray(v) ? v : v ? [v] : [])),
    latitude: z.coerce.number().min(-90).max(90).optional().default(22.5726),
    longitude: z.coerce.number().min(-180).max(180).optional().default(88.3639),
    isActive: z.coerce.boolean().optional().default(true),
  })
  .transform((v) => ({
    name: v.name,
    description: v.description,
    category: v.category,
    city: v.city,
    country: v.country,
    featured: v.featured,
    tags: v.tags,
    images: v.images,
    location: { type: "Point", coordinates: [v.longitude, v.latitude] },
    isActive: v.isActive,
  }));

const updatePlaceSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().max(2000).optional(),
    category: z.enum(PLACE_CATEGORIES).optional(),
    city: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    featured: z.coerce.boolean().optional(),
    tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    images: z.array(z.string().min(1)).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .transform((v) => {
    const out = { ...v };
    if (v.latitude !== undefined && v.longitude !== undefined) {
      out.location = { type: "Point", coordinates: [v.longitude, v.latitude] };
      delete out.latitude;
      delete out.longitude;
    }
    return out;
  });

const zodBadRequest = (res, parsed) =>
  res.status(400).json({
    ok: false,
    error: {
      message: "Validation failed",
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    },
  });

export const createPlace = async (req, res, next) => {
  try {
    // ⚠️ Multer populates req.body (strings) + req.files (uploaded files)
    const raw = {
      ...req.body,
      ...(req.body?.["tags[]"] && { tags: req.body["tags[]"] }),
      // Optionally map uploaded file URLs if your uploader sets them:
      images:
        Array.isArray(req.files) && req.files.length
          ? req.files.map((f) => f.secure_url || f.path || f.originalname).filter(Boolean)
          : req.body.images,
    };

    const parsed = createPlaceSchema.safeParse(raw);
    if (!parsed.success) {
      return zodBadRequest(res, parsed);
    }

    const place = await Place.create(parsed.data);
    return res.status(201).json({ ok: true, data: { place } });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({
        ok: false,
        error: {
          message: "Model validation failed",
          details: Object.values(err.errors).map((e) => ({
            path: e.path,
            message: e.message,
          })),
        },
      });
    }
    return next(err);
  }
};

export const listPlaces = async (req, res, next) => {
  try {
    const {
      q,
      country,
      tag,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      lat,
      lng,
      maxDistance = 50000,
    } = req.query;

    const filter = { isActive: true };
    if (q) {
      filter.$or = [
        { name: { $regex: String(q), $options: "i" } },
        { description: { $regex: String(q), $options: "i" } },
      ];
    }
    if (country) filter.country = { $regex: String(country), $options: "i" };
    if (tag) filter.tags = String(tag);

    if (lat && lng) {
      filter.location = {
        $near: {
          $geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] },
          $maxDistance: Number(maxDistance),
        },
      };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [places, total] = await Promise.all([
      Place.find(filter).sort(sort).skip(skip).limit(Number(limit)),
      Place.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      data: {
        places,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getPlace = async (req, res, next) => {
  try {
    const [place, activities] = await Promise.all([
      Place.findById(req.params.id),
      Activity.find({ place: req.params.id, isActive: true }).select(
        "title price durationMinutes images tags"
      ),
    ]);
    if (!place) throw createError(404, "Place not found");
    return res.json({
      ok: true,
      data: {
        place: { ...place.toJSON(), activities, activityCount: activities.length },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updatePlace = async (req, res, next) => {
  try {
    const parsed = updatePlaceSchema.safeParse({
      ...req.body,
      ...(req.body?.["tags[]"] && { tags: req.body["tags[]"] }),
    });
    if (!parsed.success) {
      return zodBadRequest(res, parsed);
    }

    const place = await Place.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
      runValidators: true,
    });
    if (!place) throw createError(404, "Place not found");
    return res.json({ ok: true, message: "Place updated", data: { place } });
  } catch (err) {
    next(err);
  }
};

export const deletePlace = async (req, res, next) => {
  try {
    const activityCount = await Activity.countDocuments({ place: req.params.id });
    if (activityCount > 0) {
      throw createError(400, "Cannot delete place with existing activities");
    }
    const place = await Place.findByIdAndDelete(req.params.id);
    if (!place) throw createError(404, "Place not found");
    return res.json({ ok: true, message: "Place deleted", data: { id: place.id } });
  } catch (err) {
    next(err);
  }
};

