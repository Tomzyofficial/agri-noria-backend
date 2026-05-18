import express from "express";
import trainingMaterialController from "../controllers/trainingMaterial.controller.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

// Route to handle material uploads
router.post(
  "/upload-material",
  upload.single("file"),
  trainingMaterialController.uploadTrainingMaterial,
);

router.delete(
  "/delete-material/:materialId",
  trainingMaterialController.deleteTrainingMaterial,
);

router.get("/materials", trainingMaterialController.getAllTrainingMaterials);

router.get(
  "/vendor-materials",
  trainingMaterialController.getTrainingMaterialsForVendor,
);

export default router;
