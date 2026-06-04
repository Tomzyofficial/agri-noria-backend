import {
  createStorageFacility,
  fetchListedStorage,
  getStorageStats,
  getQuoteRequests,
  updateQuoteRequestStatus,
  filterItemForSearchParams,
  updateStorage,
  deleteStorage,
} from "../../db/vendor/storage.facility.db.js";
import { saveFileToCloudinary } from "../../lib/cloudinary.img.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const storage_facilities = {};

// Create new storage facility
storage_facilities.create = async (req, res) => {
  const payload = await verifyVendorToken(req);

  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  // const eligible = await checkVendorListingEligibility(payload.id);
  // if (eligible.status !== "active" || !eligible.is_verified) {
  //    return res.status(403).json({
  //       success: false,
  //       error: "You need to be verified with an active subscription to enjoy this privilege.",
  //    });
  // }
  try {
    let {
      storage_name,
      href,
      storage_type,
      location,
      capacity,
      available,
      price,
      temperature,
      description,
      features,
    } = req.body;

    // Parse features if it's a JSON string
    if (typeof features === "string") {
      try {
        features = JSON.parse(features);
      } catch {
        // If parsing fails, try splitting by comma (fallback for old format)
        features = features
          .split(",")
          .map((f) => f.trim())
          .filter((f) => f.length > 0);
      }
    }

    // Ensure features is an array
    if (!Array.isArray(features)) {
      features = [];
    }

    const storage_image = req.file;

    if (
      !payload.id ||
      !storage_image ||
      !storage_name ||
      !href ||
      !storage_type ||
      !location ||
      !capacity ||
      !available ||
      !price ||
      !temperature ||
      !description ||
      !features ||
      features.length === 0
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    const storage_img = await saveFileToCloudinary(
      storage_image,
      "marketplace_storage",
      "image",
    );
    if (!storage_img) {
      return res
        .status(400)
        .json({ success: false, error: "Could not upload image" });
    }

    const storage = await createStorageFacility(
      payload.id,
      storage_img,
      storage_name,
      href,
      storage_type,
      location,
      capacity,
      available,
      price,
      temperature,
      description,
      features,
    );
    if (!storage.success) {
      return res.status(400).json({ success: false, error: storage.error });
    }
    res.status(201).json({
      success: true,
      storage,
      message: "Storage facility listed successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to add storage facility. Try again",
    });
  }
};

// Fetch listed products for user dashboard
storage_facilities.listedStorage = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Fetch listed items based on account id
    const result = await fetchListedStorage(payload.id);

    if (!result) {
      return res
        .status(204)
        .json({ success: false, error: "No listed storage facilities here" });
    }

    return res.status(200).json({ success: true, listed: result });
  } catch {
    return res.status(500).json({
      success: false,
      error: `Error occurred while fetching storage facilities. Try again.`,
    });
  }
};

// Get total storage facilities
storage_facilities.getStorageStats = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);

    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const stats = await getStorageStats(payload.id);
    return res.status(200).json({
      success: true,
      total: stats.total,
      view_count: stats.view_count,
      booking_click_count: stats.booking_click_count,
      quote_requests_count: stats.quote_requests_count,
    });
  } catch (error) {
    console.error("Error getting total storage:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch storage stats. Try again.`,
    });
  }
};

storage_facilities.getQuoteRequests = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const requests = await getQuoteRequests(payload.id);
    return res.status(200).json({
      success: true,
      quoteRequests: requests.quoteRequests,
      allQuoteRequests: requests.allQuoteRequests,
    });
  } catch (error) {
    console.error("Error fetching quote requests:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch quote requests. Try again.",
    });
  }
};

storage_facilities.updateQuoteRequestStatus = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const { id: requestId } = req.params;
    const status = "contacted";

    const updatedQuoteRequest = await updateQuoteRequestStatus(
      requestId,
      status,
      payload.id,
    );
    if (!updatedQuoteRequest.success) {
      return res.status(404).json({
        success: false,
        error: updatedQuoteRequest.error || "Quote request not found",
      });
    }

    return res
      .status(200)
      .json({ success: true, data: updatedQuoteRequest.data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error. Try again.",
    });
  }
};

storage_facilities.viewItem = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const storageId = req.params.id;

    if (!storageId) {
      return res
        .status(400)
        .json({ success: false, error: "Storage ID is required" });
    }

    const itemViewOnly = await filterItemForSearchParams(payload.id, storageId);

    if (!itemViewOnly) {
      return res
        .status(404)
        .json({ success: false, error: "Storage not found" });
    }

    return res.status(200).json({ success: true, storage: itemViewOnly });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

// Edit listed storage facility per product id
storage_facilities.editStorage = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const {
      existing_image_url,
      storage_name,
      href,
      storage_type,
      location,
      capacity,
      available,
      price,
      temperature,
      description,
      features,
      storageId,
    } = req.body;

    const storage_image_req = req.file;
    let storage_image = existing_image_url;

    // Only upload new image to cloud when vendor changes storage image
    if (storage_image_req && typeof storage_image_req === "object") {
      try {
        storage_image = await saveFileToCloudinary(
          storage_image_req,
          "marketplace_storage",
          "image",
        );
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        return res.status(400).json({
          success: false,
          error: "Failed to upload image. Please try again.",
        });
      }
    }

    // Parse features if it's a string
    let parsedFeatures = [];
    try {
      parsedFeatures =
        typeof features === "string" ? JSON.parse(features) : features || [];
      if (!Array.isArray(parsedFeatures)) {
        console.warn("Features is not an array, defaulting to empty array");
        parsedFeatures = [];
      }
    } catch (e) {
      console.error("Error parsing features:", e);
      parsedFeatures = [];
    }

    // Update storage facility in database
    const updated = await updateStorage(payload.id, storageId, {
      storage_image,
      storage_name,
      href: href
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
      storage_type,
      location,
      capacity: Number(capacity),
      available: Number(available),
      price: Number(price),
      temperature,
      description,
      features: parsedFeatures,
    });

    if (!updated.success) {
      console.error("Update failed - no rows affected");
      return res.status(404).json({
        success: false,
        error:
          updated.error ||
          "Storage facility not found or you don't have permission to update it",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Storage facility updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating storage facility:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred while updating the storage facility",
    });
  }
};

// Delete listed storage per vendor
storage_facilities.deleteStorage = async (req, res) => {
  const payload = await verifyVendorToken(req);

  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const { id: storageId } = req.params;
    const deleteResult = await deleteStorage(storageId, payload.id);

    if (!deleteResult.success) {
      return res.status(400).json({
        success: false,
        error: deleteResult.error || "Failed to delete storage facility",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Storage facility deleted successfully",
    });
  } catch (error) {
    console.log("error from controller", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error. Try again later.",
    });
  }
};

export default storage_facilities;
