import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

class VideoUploadService {
   constructor() {
      // Configure Cloudinary
      cloudinary.config({
         cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
         api_key: process.env.CLOUDINARY_API_KEY,
         api_secret: process.env.CLOUDINARY_API_SECRET,
      });
   }

   // Upload video to Cloudinary
   async uploadVideo(file, options = {}) {
      try {
         const defaultOptions = {
            resource_type: "video",
            folder: "agri-connect/trainings",
            format: "mp4",
            quality: "auto",
            eager: [
               {
                  format: "mp4",
                  transformation: [{ quality: "auto", fetch_format: "mp4" }, { video_codec: "auto" }],
               },
            ],
            eager_async: true,
            notification_url: process.env.CLOUDINARY_NOTIFICATION_URL,
         };

         const uploadOptions = { ...defaultOptions, ...options };

         return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
               if (error) {
                  reject(error);
               } else {
                  resolve(result);
               }
            });

            // Create readable stream from buffer
            const readableStream = Readable.from(file.buffer);
            readableStream.pipe(uploadStream);
         });
      } catch (error) {
         console.error("Error uploading video:", error);
         throw new Error("Failed to upload video");
      }
   }

   // Upload thumbnail to Cloudinary
   async uploadThumbnail(file, options = {}) {
      try {
         const defaultOptions = {
            resource_type: "image",
            folder: "agri-connect/trainings/thumbnails",
            format: "jpg",
            quality: "auto",
            transformation: [{ width: 1280, height: 720, crop: "fill", gravity: "auto" }, { quality: "auto" }],
         };

         const uploadOptions = { ...defaultOptions, ...options };

         return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
               if (error) {
                  reject(error);
               } else {
                  resolve(result);
               }
            });

            const readableStream = Readable.from(file.buffer);
            readableStream.pipe(uploadStream);
         });
      } catch (error) {
         console.error("Error uploading thumbnail:", error);
         throw new Error("Failed to upload thumbnail");
      }
   }

   // Extract video metadata
   async getVideoMetadata(publicId) {
      try {
         const result = await cloudinary.api.resource(publicId, {
            resource_type: "video",
         });

         return {
            duration: result.duration,
            format: result.format,
            size: result.bytes,
            width: result.width,
            height: result.height,
            frame_rate: result.frame_rate,
            bit_rate: result.bit_rate,
         };
      } catch (error) {
         console.error("Error getting video metadata:", error);
         throw new Error("Failed to get video metadata");
      }
   }

   // Generate thumbnail from video
   async generateThumbnailFromVideo(publicId, options = {}) {
      try {
         const defaultOptions = {
            resource_type: "video",
            format: "jpg",
            transformation: [{ width: 1280, height: 720, crop: "fill", gravity: "auto" }, { quality: "auto" }],
         };

         const thumbnailOptions = { ...defaultOptions, ...options };

         const result = await cloudinary.url(publicId, thumbnailOptions);
         return result;
      } catch (error) {
         console.error("Error generating thumbnail:", error);
         throw new Error("Failed to generate thumbnail");
      }
   }

   // Delete video from Cloudinary
   async deleteVideo(publicId) {
      try {
         const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: "video",
         });

         return result;
      } catch (error) {
         console.error("Error deleting video:", error);
         throw new Error("Failed to delete video");
      }
   }

   // Validate video file
   validateVideoFile(file) {
      const allowedMimeTypes = [
         "video/mp4",
         "video/avi",
         "video/mov",
         "video/wmv",
         "video/flv",
         "video/webm",
         "video/mkv",
      ];

      const maxSize = 500 * 1024 * 1024; // 500MB

      if (!allowedMimeTypes.includes(file.mimetype)) {
         throw new Error("Invalid video format. Allowed formats: MP4, AVI, MOV, WMV, FLV, WebM, MKV");
      }

      if (file.size > maxSize) {
         throw new Error("Video file size must be less than 500MB");
      }

      return true;
   }

   // Validate image file (for thumbnails)
   validateImageFile(file) {
      const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

      const maxSize = 10 * 1024 * 1024; // 10MB

      if (!allowedMimeTypes.includes(file.mimetype)) {
         throw new Error("Invalid image format. Allowed formats: JPEG, PNG, WebP");
      }

      if (file.size > maxSize) {
         throw new Error("Image file size must be less than 10MB");
      }

      return true;
   }

   // Get video streaming URL
   getStreamingUrl(publicId, options = {}) {
      const defaultOptions = {
         resource_type: "video",
         format: "mp4",
         streaming_profile: "full_hd",
         secure: true,
      };

      const streamOptions = { ...defaultOptions, ...options };

      return cloudinary.url(publicId, streamOptions);
   }

   // Get multiple quality streaming URLs
   getMultiQualityUrls(publicId) {
      const qualities = [
         { name: "360p", transformation: { height: 360, crop: "scale" } },
         { name: "480p", transformation: { height: 480, crop: "scale" } },
         { name: "720p", transformation: { height: 720, crop: "scale" } },
         { name: "1080p", transformation: { height: 1080, crop: "scale" } },
      ];

      const urls = {};
      qualities.forEach((quality) => {
         urls[quality.name] = cloudinary.url(publicId, {
            resource_type: "video",
            format: "mp4",
            transformation: quality.transformation,
            secure: true,
         });
      });

      return urls;
   }
}

export default new VideoUploadService();
