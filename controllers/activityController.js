import createError from "http-errors";
import { z } from "zod";
import mongoose from "mongoose";
import { Activity, ACTIVITY_CATEGORIES } from "../models/Activity.js";
import { Place } from "../models/Place.js";

const DEV = process.env.NODE_ENV !== "production";
const zObjectId = z.string().refine((v) => mongoose.isValidObjectId(v), "must be a valid objectId");

const zCategory = z
  .enum(ACTIVITY_CATEGORIES, {
    errorMap: () => ({ message: "category must be one of: " + ACTIVITY_CATEGORIES.join(", ") }),
  })
  .optional()
  .default("cultural");

const zTagsFlexible = z
  .union([z.array(z.string().min(1).max(50)), z.string().min(1).max(50)])
  .optional()
  .transform((v) => (Array.isArray(v) ? v : v ? [v] : []))
  .refine((arr) => arr.length <= 20, "tags must be <= 20");

const zImagesFlexible = z
  .union([z.array(z.string().min(1)), z.string().min(1)])
  .optional()
  .transform((v) => (Array.isArray(v) ? v : v ? [v] : []))
  .refine((arr) => arr.length <= 10, "images must be <= 10");

const createActivitySchema = z.object({
  title: z.string().trim().min(2, "title must be at least 2 chars").max(100),
  place: zObjectId,
  price: z.coerce.number().min(0).max(50000),
  durationMinutes: z.coerce.number().int().min(15).max(1440).optional().default(60),
  description: z.string().max(2000).optional().default(""),
  category: zCategory,
  featured: z.coerce.boolean().optional().default(false),
  isPublished: z.coerce.boolean().optional().default(true),
  isActive: z.coerce.boolean().optional().default(true),
  capacity: z.coerce.number().int().min(1).max(100).optional().default(20),
  tags: zTagsFlexible,
  images: zImagesFlexible,
});

const updateActivitySchema = z.object({
  title: z.string().trim().min(2).max(100).optional(),
  place: zObjectId.optional(),
  price: z.coerce.number().min(0).max(50000).optional(),
  durationMinutes: z.coerce.number().int().min(15).max(1440).optional(),
  description: z.string().max(2000).optional(),
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  featured: z.coerce.boolean().optional(),
  isPublished: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  capacity: z.coerce.number().int().min(1).max(100).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  images: z.array(z.string().min(1)).max(10).optional(),
});

const zodBadRequest = (res, parsed) =>
  res.status(400).json({
    ok: false,
    error: {
      message: "Validation failed",
      details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    },
  });

/** Merge files and body images safely. Accept "images" or "images[]". */
function extractImages(req) {
  const bodyImgs = (() => {
    if (req.body?.images) return req.body.images;
    if (req.body?.["images[]"]) return req.body["images[]"];
    return undefined;
  })();

  const bodyArray = Array.isArray(bodyImgs) ? bodyImgs : bodyImgs ? [bodyImgs] : [];

  const fileArray =
    Array.isArray(req.files) && req.files.length
      ? req.files.map((f) => f.secure_url || f.path || f.originalname).filter(Boolean)
      : [];

  return [...bodyArray, ...fileArray];
}

export const createActivity = async (req, res, next) => {
  try {
    const raw = {
      ...req.body,
      ...(req.body?.["tags[]"] && { tags: req.body["tags[]"] }),
      images: extractImages(req),
    };

    const parsed = createActivitySchema.safeParse(raw);
    if (!parsed.success) {
      if (DEV) console.error("[createActivity] Zod errors:", parsed.error.issues);
      return zodBadRequest(res, parsed);
    }

    const place = await Place.findById(parsed.data.place).select("_id");
    if (!place) throw createError(400, "Referenced place does not exist");

    const activity = await Activity.create(parsed.data);
    const populated = await Activity.findById(activity._id).populate("place", "name location");

    return res.status(201).json({ ok: true, message: "Activity created", data: { activity: populated } });
  } catch (err) {
    if (DEV) console.error("[createActivity] error:", err);
    if (err?.name === "ValidationError") {
      return res.status(400).json({
        ok: false,
        error: {
          message: "Model validation failed",
          details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
        },
      });
    }
    next(err);
  }
};

const parseSelect = (sel) =>
  String(sel || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

export const listActivities = async (req, res, next) => {
  try {
    const {
      q,
      placeId, // FE
      category,
      tag,
      featured,
      isPublished,
      priceMin,
      priceMax,
      durationMin,
      durationMax,
      select,
      page = 1,
      limit = 20,
      sortBy,
      sort, // alias of sortBy
      order = "desc",
    } = req.query;

    const filter = { isActive: true };

    if (q) {
      filter.$or = [
        { title: { $regex: String(q), $options: "i" } },
        { description: { $regex: String(q), $options: "i" } },
      ];
    }
    if (placeId && mongoose.isValidObjectId(placeId)) filter.place = placeId;
    if (category) filter.category = { $regex: String(category), $options: "i" };
    if (tag) filter.tags = String(tag);
    if (featured !== undefined) filter.featured = String(featured) === "true";
    if (isPublished !== undefined) filter.isPublished = String(isPublished) === "true";

    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) filter.price.$gte = Number(priceMin);
      if (priceMax) filter.price.$lte = Number(priceMax);
    }
    if (durationMin || durationMax) {
      filter.durationMinutes = {};
      if (durationMin) filter.durationMinutes.$gte = Number(durationMin);
      if (durationMax) filter.durationMinutes.$lte = Number(durationMax);
    }

    const proj = parseSelect(select);
    const sortField = sort || sortBy || "createdAt";
    const sortOrder = String(order).toLowerCase() === "asc" ? 1 : -1;
    const skip = (Number(page) - 1) * Number(limit);
    const lim = Math.min(Number(limit), 1000);

    const latest = await Activity.find(filter).sort({ updatedAt: -1 }).select("updatedAt").limit(1).lean();
    if (latest?.[0]?.updatedAt) {
      const lastMod = latest[0].updatedAt.toUTCString();
      res.setHeader("Last-Modified", lastMod);
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      const ims = req.headers["if-modified-since"];
      if (ims && new Date(ims) >= new Date(lastMod)) return res.status(304).end();
    }

    const [activities, total] = await Promise.all([
      Activity.find(filter)
        .select(proj || undefined)
        .populate(proj ? undefined : { path: "place", select: "name location images" })
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(lim)
        .lean(),
      Activity.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      data: {
        activities,
        pagination: { page: Number(page), limit: lim, total, pages: Math.ceil(total / Math.max(1, lim)) },
      },
    });
  } catch (err) {
    if (DEV) console.error("[listActivities] error:", err);
    next(err);
  }
};

export const getActivity = async (req, res, next) => {
  try {
    const activity = await Activity.findById(req.params.id).populate(
      "place",
      "name description location images tags"
    );
    if (!activity) throw createError(404, "Activity not found");
    return res.json({ ok: true, data: { activity } });
  } catch (err) {
    if (DEV) console.error("[getActivity] error:", err);
    next(err);
  }
};

export const updateActivity = async (req, res, next) => {
  try {
    const raw = {
      ...req.body,
      ...(req.body?.["tags[]"] && { tags: req.body["tags[]"] }),
      // allow switching to URL list during update too
      ...(req.body?.images && { images: Array.isArray(req.body.images) ? req.body.images : [req.body.images] }),
    };
    const parsed = updateActivitySchema.safeParse(raw);
    if (!parsed.success) {
      if (DEV) console.error("[updateActivity] Zod errors:", parsed.error.issues);
      return zodBadRequest(res, parsed);
    }

    if (parsed.data.place) {
      const place = await Place.findById(parsed.data.place).select("_id");
      if (!place) throw createError(400, "Referenced place does not exist");
    }

    const activity = await Activity.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
      runValidators: true,
    }).populate("place", "name location");

    if (!activity) throw createError(404, "Activity not found");

    return res.json({ ok: true, message: "Activity updated", data: { activity } });
  } catch (err) {
    if (DEV) console.error("[updateActivity] error:", err);
    if (err?.name === "ValidationError") {
      return res.status(400).json({
        ok: false,
        error: {
          message: "Model validation failed",
          details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
        },
      });
    }
    next(err);
  }
};

export const deleteActivity = async (req, res, next) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) throw createError(404, "Activity not found");
    return res.json({ ok: true, message: "Activity deleted", data: { id: activity.id } });
  } catch (err) {
    if (DEV) console.error("[deleteActivity] error:", err);
    next(err);
  }
};
