import {
  getVendorProfileInfo,
  checkVerifiedVendor,
  getUpdatedProfileImage,
  uploadVendorProfileImage,
  upsertVendorDocuments,
  upsertVendorBankAccount,
  getRatings,
  finalizeOnboarding,
} from "../../db/vendor/profile.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import { saveFileToCloudinary } from "../../lib/cloudinary.img.js";

const profileController = {};
// Upload profile image
profileController.uploadProfileImage = async (req, res) => {
  try {
    // Verify authentication
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Validate file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No image file provided",
      });
    }

    // Validate file type
    if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({
        success: false,
        error: "Invalid file type. Only image files are allowed",
      });
    }

    // Validate file size (5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: "File size exceeds 5MB limit",
      });
    }

    // Upload to Cloudinary
    const imageUrl = await saveFileToCloudinary(
      req.file,
      "vendor_profile_images",
      "image",
    );
    if (!imageUrl.secure_url) {
      return { success: false, error: "Failed to upload image to Cloudinary" };
    }

    // Save to database
    const savedImageUrl = await uploadVendorProfileImage(
      payload.id,
      imageUrl.secure_url,
    );
    if (!savedImageUrl) {
      return { success: false, error: "Failed to save image URL to database" };
    }

    return res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      data: savedImageUrl,
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to upload profile image",
    });
  }
};

// Get profile image
profileController.getProfileImage = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }
    const imageUrl = await getUpdatedProfileImage(payload.id);
    // console.log(imageUrl);
    if (!imageUrl) {
      return res.status(404).json({
        success: false,
        error: "Profile image not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: imageUrl ?? "",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch profile image",
    });
  }
};

// Check for verified vendor
profileController.isVendorVerified = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const isVerified = await checkVerifiedVendor(payload.id);
    return res.status(200).json({
      success: true,
      data: isVerified,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

profileController.profileInfo = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const profileInfo = await getVendorProfileInfo(payload.id);

    if (!profileInfo) {
      return res.status(404).json({
        success: false,
        error: "Profile information not found",
      });
    }
    return res.status(200).json({
      data: profileInfo,
    });
  } catch (error) {
    console.error("Error fetching profile info:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch profile info",
    });
  }
};

// Edit profile information, documents, and bank details
profileController.editProfile = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Extract form data
    const {
      business_name,
      hot_line_phone_number,
      address,
      business_desc,
      bank_name,
      account_name,
      account_number,
    } = req.body;

    // Handle file uploads - req.files is used when using upload.fields()
    let id_front_url = null;
    let id_back_url = null;
    let license_url = null;

    // Process files if they exist (upload.fields() stores files in req.files)
    if (req.files) {
      // Handle ID front file
      if (req.files["id_front_url"] && req.files["id_front_url"][0]) {
        const file = req.files["id_front_url"][0];
        // Validate file type
        if (!file.mimetype || !file.mimetype.startsWith("image/")) {
          return res.status(400).json({
            success: false,
            error: "ID front file must be an image",
          });
        }
        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          return res.status(400).json({
            success: false,
            error: "ID front file size exceeds 5MB limit",
          });
        }
        id_front_url = await saveFileToCloudinary(
          file,
          "vendor_documents",
          "image",
        );
      }

      // Handle ID back file
      if (req.files["id_back_url"] && req.files["id_back_url"][0]) {
        const file = req.files["id_back_url"][0];
        if (!file.mimetype || !file.mimetype.startsWith("image/")) {
          return res.status(400).json({
            success: false,
            error: "ID back file must be an image",
          });
        }
        if (file.size > 5 * 1024 * 1024) {
          return res.status(400).json({
            success: false,
            error: "ID back file size exceeds 5MB limit",
          });
        }
        id_back_url = await saveFileToCloudinary(
          file,
          "vendor_documents",
          "image",
        );
      }

      // Handle license file
      if (req.files["license_url"] && req.files["license_url"][0]) {
        const file = req.files["license_url"][0];
        if (!file.mimetype || !file.mimetype.startsWith("image/")) {
          return res.status(400).json({
            success: false,
            error: "License file must be an image",
          });
        }
        if (file.size > 5 * 1024 * 1024) {
          return res.status(400).json({
            success: false,
            error: "License file size exceeds 5MB limit",
          });
        }
        license_url = await saveFileToCloudinary(
          file,
          "vendor_documents",
          "image",
        );
      }
    }

    // Determine if we need to update documents (business info or files)
    const hasBusinessData =
      business_name || hot_line_phone_number || address || business_desc;
    const hasFileData = id_front_url || id_back_url || license_url;

    // Update profile information if business data or files are provided
    if (hasBusinessData || hasFileData) {
      const updateDoc = await upsertVendorDocuments(
        payload.id,
        business_name || null,
        hot_line_phone_number || null,
        address || null,
        business_desc || null,
        id_front_url,
        id_back_url,
        license_url,
      );
      if (!updateDoc) {
        return res.status(400).json({
          success: false,
          error: "Failed to update profile document information",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Profile document information updated successfully",
        updateDoc,
      });
    }

    // Update bank details if any bank field is provided
    if (bank_name || account_name || account_number) {
      const updateBank = await upsertVendorBankAccount(
        payload.id,
        bank_name || null,
        account_name || null,
        account_number || null,
      );
      if (!updateBank) {
        return res.status(400).json({
          success: false,
          error: "Failed to update bank details.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Bank details updated successfully",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to update profile",
    });
  }
};

// Controller for vendor product ratings
profileController.ratings = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);

    if (!payload) {
      return res.status(400).json({
        success: false,
        error: "Vendor ID is required",
      });
    }
    const ratings = await getRatings(payload.id);

    if (!ratings || ratings.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No ratings found for this vendor",
      });
    }
    return res.status(200).json({
      success: true,
      data: ratings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

profileController.completeOnboarding = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const success = await finalizeOnboarding(payload.id);
    if (!success) throw new Error("Failed to finalize onboarding in DB");

    return res.status(200).json({
      success: true,
      message: "Onboarding finalized successfully",
    });
  } catch (error) {
    console.error("Error finalizing onboarding:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to finalize onboarding",
    });
  }
};

export default profileController;
