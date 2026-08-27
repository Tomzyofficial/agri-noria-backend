import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import {
  droneListingsDb,
  getQuoteRequests,
  updateQuoteRequestStatus,
} from "../../db/drone/listings.db.js";
import {
  deleteFileFromCloudinary,
  saveFileToCloudinary,
} from "../../lib/cloudinary.img.js";
import { AppError } from "../../utils/AppError.js";

const droneController = {};

droneController.createDroneListing = async (req, res) => {
  let uploadedPublicIds = [];

  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const listing = req.body;
    const files = req.files?.image;
    const savedFiles = files?.length
      ? await saveFileToCloudinary(files, "drones", "image")
      : [];
    uploadedPublicIds = savedFiles.map((file) => file.public_id);
    const result = await droneListingsDb.createListing(payload.id, {
      ...listing,
      image: {
        urls: savedFiles.map((file) => file.secure_url),
        publicIds: uploadedPublicIds,
      },
    });
    if (result) {
      res.status(201).json(result);
    } else {
      await deleteFileFromCloudinary(uploadedPublicIds);
      res.status(400).json({ error: "Failed to create drone listing" });
    }
  } catch (error) {
    await deleteFileFromCloudinary(uploadedPublicIds);
    console.error("Error creating drone listing:", error);
    res.status(500).json({ error: "Internal server error. Try again later." });
  }
};

droneController.getVendorInventory = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { limit } = req.query;
    const { page } = req.query;

    const getInventory = await droneListingsDb.getVendorInventory(
      payload.id,
      page,
      limit,
    );
    res.status(200).json({ success: true, data: getInventory });
  } catch (error) {
    console.error("error occurred", error);
    res.status(500).json({
      success: false,
      error: "Internal server error. Try again later.",
    });
  }
};

droneController.getSingleListing = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { id } = req.params;

  try {
    const getSingle = await droneListingsDb.getSingleListing(id, payload.id);
    if (!getSingle) {
      return res
        .status(404)
        .json({ success: false, error: "Listing not found" });
    }
    return res.status(200).json({ success: true, data: getSingle });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

droneController.updateDroneListing = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { id } = req.params;
    const files = req.files?.image;
    let uploadedPublicIds = [];

    try {
      const updates = { ...req.body };
      if (files?.length) {
        const savedFiles = await saveFileToCloudinary(files, "drones", "image");
        uploadedPublicIds = savedFiles.map((file) => file.public_id);
        updates.image = {
          urls: savedFiles.map((file) => file.secure_url),
          publicIds: uploadedPublicIds,
        };
      }

      const result = await droneListingsDb.updateListing(
        id,
        payload.id,
        updates,
      );

      if (!result) {
        await deleteFileFromCloudinary(uploadedPublicIds);
        return res.status(404).json({
          success: false,
          error: "Listing not found or unauthorized",
        });
      }

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      await deleteFileFromCloudinary(uploadedPublicIds);
      throw error;
    }
  } catch (error) {
    console.error("Error updating drone listing:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

droneController.deleteDroneListing = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { id } = req.params;

    const result = await droneListingsDb.deleteListing(id, payload.id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: "Listing not found or unauthorized",
      });
    }

    if (result.publicIds?.length) {
      try {
        await deleteFileFromCloudinary(result.publicIds);
      } catch (cleanupError) {
        console.error("Drone image cleanup failed:", cleanupError);
      }
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete this item. Please try again later.",
    });
  }
};

droneController.getDashboardStats = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const getStats = await droneListingsDb.getDashboardStats(payload.id);
    return res.status(200).json({ success: true, data: getStats });
  } catch (error) {
    console.log("erro", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

droneController.getPublicListings = async (req, res) => {
  try {
    const { page = 1, limit = 12, country } = req.query;
    const listings = await droneListingsDb.getPublicListings(
      Number(page),
      Number(limit),
      country,
    );
    return res.status(200).json({ success: true, data: listings });
  } catch (error) {
    console.error("Error fetching public drone listings:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

droneController.getPublicSingleListing = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await droneListingsDb.getPublicSingleListing(id);
    if (!listing) {
      return res
        .status(404)
        .json({ success: false, error: "Listing not found" });
    }
    return res.status(200).json({ success: true, data: listing });
  } catch (error) {
    console.error("Error fetching public drone listing:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

droneController.getQuoteRequests = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const getQuote = await getQuoteRequests(payload.id);
  if (!getQuote) {
    return res
      .status(404)
      .json({ success: false, error: "No quote requests found" });
  }
  return res.status(200).json({
    success: true,
    quoteRequests: getQuote.quoteRequests,
    allQuoteRequests: getQuote.allQuoteRequests,
  });
};

droneController.updateQuoteRequestStatus = async (req, res) => {
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
    if (!updatedQuoteRequest?.success || !updatedQuoteRequest?.data) {
      return res.status(404).json({
        success: false,
        error: updatedQuoteRequest?.error || "Quote request not found",
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

export default droneController;
