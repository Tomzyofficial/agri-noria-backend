import videoUploadService from "../../services/videoUpload.service.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const videoUploadController = {};

// Upload video file
videoUploadController.uploadVideo = async (req, res) => {
   try {
      // Verify vendor authentication
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({
            success: false,
            error: "Unauthorized",
         });
      }

      if (!req.file) {
         return res.status(400).json({
            success: false,
            error: "No video file provided",
         });
      }

      // Validate video file
      videoUploadService.validateVideoFile(req.file);

      // Upload video to Cloudinary
      const result = await videoUploadService.uploadVideo(req.file, {
         public_id: `training_${payload.id}_${Date.now()}`,
         context: {
            vendor_id: payload.id,
            vendor_name: `${payload.fname} ${payload.lname}`,
         },
      });

      // Get video metadata
      const metadata = await videoUploadService.getVideoMetadata(result.public_id);

      // Generate thumbnail
      const thumbnailUrl = videoUploadService.generateThumbnailFromVideo(result.public_id);

      return res.status(200).json({
         success: true,
         data: {
            publicId: result.public_id,
            url: result.secure_url,
            thumbnailUrl,
            metadata: {
               duration: metadata.duration,
               size: metadata.size,
               width: metadata.width,
               height: metadata.height,
               format: metadata.format,
            },
         },
      });
   } catch (error) {
      console.error("Error uploading video:", error);
      return res.status(500).json({
         success: false,
         error: error.message || "Failed to upload video",
      });
   }
};

// Upload thumbnail image
videoUploadController.uploadThumbnail = async (req, res) => {
   try {
      // Verify vendor authentication
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({
            success: false,
            error: "Unauthorized",
         });
      }

      if (!req.file) {
         return res.status(400).json({
            success: false,
            error: "No image file provided",
         });
      }

      // Validate image file
      videoUploadService.validateImageFile(req.file);

      // Upload thumbnail to Cloudinary
      const result = await videoUploadService.uploadThumbnail(req.file, {
         public_id: `thumbnail_${payload.id}_${Date.now()}`,
         context: {
            vendor_id: payload.id,
            vendor_name: `${payload.fname} ${payload.lname}`,
         },
      });

      return res.status(200).json({
         success: true,
         data: {
            publicId: result.public_id,
            url: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
         },
      });
   } catch (error) {
      console.error("Error uploading thumbnail:", error);
      return res.status(500).json({
         success: false,
         error: error.message || "Failed to upload thumbnail",
      });
   }
};

// Get video streaming URLs
videoUploadController.getStreamingUrls = async (req, res) => {
   try {
      const { publicId } = req.params;

      if (!publicId) {
         return res.status(400).json({
            success: false,
            error: "Public ID is required",
         });
      }

      // Get streaming URL
      const streamingUrl = videoUploadService.getStreamingUrl(publicId);

      // Get multiple quality URLs
      const multiQualityUrls = videoUploadService.getMultiQualityUrls(publicId);

      return res.status(200).json({
         success: true,
         data: {
            streamingUrl,
            multiQualityUrls,
         },
      });
   } catch (error) {
      console.error("Error getting streaming URLs:", error);
      return res.status(500).json({
         success: false,
         error: "Failed to get streaming URLs",
      });
   }
};

// Delete video
videoUploadController.deleteVideo = async (req, res) => {
   try {
      // Verify vendor authentication
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({
            success: false,
            error: "Unauthorized",
         });
      }

      const { publicId } = req.params;

      if (!publicId) {
         return res.status(400).json({
            success: false,
            error: "Public ID is required",
         });
      }

      // Delete video from Cloudinary
      const result = await videoUploadService.deleteVideo(publicId);

      return res.status(200).json({
         success: true,
         data: result,
      });
   } catch (error) {
      console.error("Error deleting video:", error);
      return res.status(500).json({
         success: false,
         error: "Failed to delete video",
      });
   }
};

export default videoUploadController;
