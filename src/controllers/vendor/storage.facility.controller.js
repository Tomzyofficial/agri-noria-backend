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
import {
  deleteFileFromCloudinary,
  saveFileToCloudinary,
} from "../../lib/cloudinary.img.js";
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
  let publicId = [];
  const cleanupUploadedFiles = async () => {
    if (publicId.length === 0) return;

    try {
      await deleteFileFromCloudinary(publicId);
    } catch (cleanupError) {
      console.error("Failed to clean up storage images:", cleanupError);
    }
  };

  try {
    let {
      listing_name,
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

    const image = req.files?.image || [];

    if (image.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one storage image is required",
      });
    }

    if (
      !payload.id ||
      !image ||
      !listing_name ||
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

    const imagesToCloudinary = await saveFileToCloudinary(
      image,
      "marketplace_storage",
      "image",
    );

    const imageUrl = imagesToCloudinary?.map((image) => image.secure_url);
    publicId = imagesToCloudinary.map((image) => image.public_id);

    const storage = await createStorageFacility(
      payload.id,
      imageUrl,
      listing_name,
      href,
      storage_type,
      location,
      capacity,
      available,
      price,
      temperature,
      description,
      features,
      publicId,
    );
    if (!storage.success) {
      await cleanupUploadedFiles();
      return res.status(400).json({ success: false, error: storage.error });
    }
    res.status(201).json({
      success: true,
      storage,
      message: "Storage facility listed successfully.",
    });
  } catch (error) {
    await cleanupUploadedFiles();
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
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  let publicId = [];
  const cleanupUploadedFiles = async () => {
    if (publicId.length === 0) return;

    try {
      await deleteFileFromCloudinary(publicId);
    } catch (cleanupError) {
      console.error("Failed to clean up storage images:", cleanupError);
    }
  };

  try {
    const {
      listing_name,
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

    let parsedFeatures;
    try {
      parsedFeatures = Array.isArray(features)
        ? features
        : JSON.parse(features);
      if (
        !Array.isArray(parsedFeatures) ||
        parsedFeatures.some(
          (feature) => typeof feature !== "string" || !feature.trim(),
        )
      ) {
        throw new Error("Features must be a non-empty array of strings");
      }
      parsedFeatures = parsedFeatures.map((feature) => feature.trim());
    } catch {
      return res.status(400).json({
        success: false,
        error: "Features must be a valid array of strings",
      });
    }

    const image_req = req.files?.image || [];
    const saveToCloudinary = image_req.length
      ? await saveFileToCloudinary(image_req, "marketplace_storage", "image")
      : [];

    const image = saveToCloudinary.map((img) => img.secure_url);
    publicId = saveToCloudinary.map((img) => img.public_id);

    // Update storage facility in database
    const updated = await updateStorage(payload.id, storageId, {
      image,
      listing_name,
      href: (href || listing_name)
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
      storage_type,
      location,
      capacity,
      available,
      price: Number(price),
      temperature,
      description,
      features: parsedFeatures,
      publicId,
    });

    if (!updated.success) {
      console.error("Update failed - no rows affected");
      await cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        error: updated.error || "Update failed, please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Storage facility updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating storage facility:", error);
    await cleanupUploadedFiles();
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

    if (deleteResult.publicIds.length > 0) {
      try {
        await deleteFileFromCloudinary(deleteResult.publicIds);
      } catch (cleanupError) {
        console.error(
          "Storage facility deleted, but image cleanup failed:",
          cleanupError,
        );
      }
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
