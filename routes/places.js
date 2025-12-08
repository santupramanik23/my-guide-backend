import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateObjectIdParam } from "../middleware/objectIdParam.js";
import {
  createPlace,
  listPlaces,
  getPlace,
  updatePlace,
  deletePlace,
} from "../controllers/placeController.js";

// why: parse multipart/form-data so text fields appear in req.body
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

const r = Router();

r.get("/", listPlaces);
r.get("/:id", validateObjectIdParam("id"), getPlace);

// ⬇️ Multer must be before controller to populate req.body + req.files
r.post("/", requireAuth, requireRole("admin"), upload.array("images", 10), createPlace);
r.put("/:id", requireAuth, requireRole("admin"), validateObjectIdParam("id"), updatePlace);
r.delete("/:id", requireAuth, requireRole("admin"), validateObjectIdParam("id"), deletePlace);

export default r;