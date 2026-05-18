import express from "express";
import videoUploadController from "../../controllers/vendor/videoUpload.controller.js";
import { upload } from "../../middlewares/upload.js";

const uploadRoute = express.Router();

// Upload video file
uploadRoute.post("/video", upload.single("video"), videoUploadController.uploadVideo);

// Upload thumbnail image
uploadRoute.post("/thumbnail", upload.single("thumbnail"), videoUploadController.uploadThumbnail);

// Get streaming URLs for a video
uploadRoute.get("/stream/:publicId", videoUploadController.getStreamingUrls);

// Delete video
uploadRoute.delete("/video/:publicId", videoUploadController.deleteVideo);

export default uploadRoute;
