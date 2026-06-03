import {
  uploadTrainingMaterial,
  getMaterialsByVendor,
  getUploadedMaterials,
  deleteMaterial,
} from "../db/vendor/trainingMaterial.db.js";

import { saveFileToCloudinary } from "../lib/cloudinary.img.js";
import { verifyVendorToken } from "../sessions/vendor.auth.session.js";

const trainingMaterialController = {};

trainingMaterialController.uploadTrainingMaterial = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing token.",
    });
  }
  try {
    const { title, description, category } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded. Ensure 'file' field is included.",
      });
    }

    const fileType = file.mimetype;
    const fileSize = file.size;
    let resourceType;

    if (fileType.startsWith("image")) {
      resourceType = "image";
    } else if (fileType.startsWith("video")) {
      resourceType = "video";
    } else if (fileType.startsWith("application/pdf")) {
      resourceType = "raw";
    } else {
      return res
        .status(400)
        .json({ success: false, error: `Unsupported file type: ${fileType}` });
    }

    if (fileSize > 100 * 1024 * 1024) {
      return res
        .status(400)
        .json({ success: false, error: "File size exceeds the 100MB limit." });
    }

    const uploadVideo = await saveFileToCloudinary(
      file,
      "training_materials",
      resourceType,
    );

    const savedMaterial = await uploadTrainingMaterial(
      payload.id,
      title,
      description,
      uploadVideo.secure_url,
      fileType,
      fileSize,
      category,
    );

    res.status(201).json({
      success: true,
      message: "Material uploaded successfully.",
      material: savedMaterial,
    });
  } catch (error) {
    console.error("Error uploading material:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

trainingMaterialController.deleteTrainingMaterial = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing token.",
    });
  }
  const { materialId } = req.params;
  try {
    const result = await deleteMaterial(materialId, payload.id);
    if (result.success) {
      res
        .status(200)
        .json({ success: true, message: "Material deleted successfully." });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || "Failed to delete material.",
      });
    }
  } catch (error) {
    console.error("Error deleting material:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

trainingMaterialController.getTrainingMaterialsForVendor = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const materials = await getMaterialsByVendor(payload.id);
    res.status(200).json({ success: true, data: materials.data });
  } catch (error) {
    console.error("Error fetching training materials:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch training materials." });
  }
};

trainingMaterialController.getAllTrainingMaterials = async (req, res) => {
  try {
    const materials = await getUploadedMaterials();

    res.status(200).json({ success: true, data: materials });
  } catch (error) {
    console.error("Error fetching training materials:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch training materials." });
  }
};

export default trainingMaterialController;
