import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import { droneListingsDb } from "../../db/drone/listings.db.js";
import { AppError } from "../../utils/AppError.js";

const droneController = {};

droneController.createDroneListing = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const listing = req.body;
    const files = req.files?.image;
    const result = await droneListingsDb.createListing(payload.id, {
      ...listing,
      image: files || null,
    });
    if (result) {
      res.status(201).json(result);
    } else {
      res.status(400).json({ error: "Failed to create drone listing" });
    }
  } catch (error) {
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
    return res.status(500).json({ success: false, error: error.message });
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
    console.log("erro", error);
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

    const updates = { ...req.body };
    if (files?.length) {
      updates.image = files;
    }

    const result = await droneListingsDb.updateListing(id, payload.id, updates);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Listing not found or unauthorized",
      });
    }

    return res.status(200).json({ success: true, data: result });
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
    const { page = 1, limit = 12 } = req.query;
    const listings = await droneListingsDb.getPublicListings(
      Number(page),
      Number(limit),
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

export default droneController;
