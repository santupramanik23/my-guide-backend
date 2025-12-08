// // routes/activities.js
// import { Router } from 'express';
// import {
//   listActivities,
//   getActivity,
//   createActivity,
//   updateActivity,
//   deleteActivity,
// } from '../controllers/activityController.js';
// import { requireAuth, requireRole } from '../middleware/auth.js';
// import { validateObjectIdParam } from '../middleware/objectIdParam.js';

// const router = Router();

// router.get('/', listActivities);
// router.get('/:id', getActivity);
// router.get('/:id', validateObjectIdParam('id'), getActivity);
// router.post('/', requireAuth, requireRole('admin'), createActivity);
// router.patch('/:id', requireAuth, requireRole('admin'), validateObjectIdParam('id'), updateActivity);
// router.delete('/:id', requireAuth, requireRole('admin'), validateObjectIdParam('id'), deleteActivity);


// export default router;

import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateObjectIdParam } from "../middleware/objectIdParam.js";
import {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
} from "../controllers/activityController.js";

// why: parse multipart/form-data so text fields appear in req.body
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

const r = Router();

r.get("/", listActivities);
r.get("/:id", validateObjectIdParam("id"), getActivity);

// Multer must be before controller to populate req.body + req.files
// Accept both "images" and "images[]"
r.post(
  "/",
  requireAuth,
  requireRole("admin"),
  upload.fields([{ name: "images", maxCount: 10 }, { name: "images[]", maxCount: 10 }]),
  (req, _res, next) => {
    // flatten to req.files as an array for extractImages()
    req.files = [...(req.files?.images || []), ...(req.files?.["images[]"] || [])];
    next();
  },
  createActivity
);

r.patch("/:id", requireAuth, requireRole("admin"), validateObjectIdParam("id"), updateActivity);
r.delete("/:id", requireAuth, requireRole("admin"), validateObjectIdParam("id"), deleteActivity);

export default r;