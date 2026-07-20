import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

if (process.env.CLOUDINARY_API_KEY) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    secure: true,
  });
}

export { cloudinary };

// This function handles deleting file from the cloudinary still needs more worm.
export async function deleteFileFromCloudinary(imageUrl) {
  try {
    if (!imageUrl) return { success: false, message: "No image URL provided" };
    // Extract public_id from the URL
    const parts = imageUrl.split("/");
    const fileName = parts.pop();
    const folder = parts.slice(parts.indexOf("upload") + 2).join("/");

    const publicId =
      folder + "/" + fileName.substring(0, fileName.lastIndexOf("."));
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    return {
      success: false,
      error: "Failed to delete image from cloud.",
    };
  }
}

export async function deleteFile(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);

    console.log("delete from cloud", result);
    return result;
  } catch (error) {
    console.error("Error deleting file:", error);
    throw new Error("Failed to delete file");
  }
}

async function uploadSingleFile(file, folder, resourceType) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        format: resourceType === "raw" ? "pdf" : undefined,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      },
    );

    const readableStream = Readable.from(file.buffer);
    readableStream.pipe(uploadStream);
  });
}

export async function saveFileToCloudinary(fileOrFiles, folder, resourceType) {
  if (!fileOrFiles) {
    return null;
  }

  if (Array.isArray(fileOrFiles)) {
    return Promise.all(
      fileOrFiles.map((file) => uploadSingleFile(file, folder, resourceType)),
    );
  }

  return uploadSingleFile(fileOrFiles, folder, resourceType);
}
