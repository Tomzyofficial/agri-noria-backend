import {
  getListings,
  createListing,
  getListingById,
  getListingImages,
  recordListingView,
  updateListing,
  deleteListing,
} from "../../db/farmDevelopment/listings.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const listingsController = {};

listingsController.getListings = async (req, res) => {
  try {
    const status = req.query.status || "active";
    const companyId = req.query.companyId;
    const category = req.query.category;

    const listings = await getListings(status, companyId, category);

    if (!listings) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch listings",
      });
    }

    return res.status(200).json({
      success: true,
      data: listings,
    });
  } catch (error) {
    console.error("Error in getListings controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch listings",
    });
  }
};

listingsController.createListing = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const {
      companyId,
      categoryId,
      title,
      description,
      price,
      priceType,
      location,
    } = req.body;

    if (!companyId || !categoryId || !title) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: companyId, categoryId, title",
      });
    }

    const listing = await createListing(
      companyId,
      categoryId,
      title,
      description,
      price,
      priceType,
      location,
    );

    if (!listing) {
      return res.status(500).json({
        success: false,
        error: "Failed to create listing",
      });
    }

    return res.status(201).json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error("Error in createListing controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create listing",
    });
  }
};

listingsController.getListingById = async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await getListingById(id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: "Listing not found",
      });
    }

    // Fetch images
    const images = await getListingImages(id);
    listing.images = images;

    // Record view
    const ipAddress =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    await recordListingView(id, ipAddress, userAgent);

    return res.status(200).json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error("Error in getListingById controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch listing",
    });
  }
};

listingsController.updateListing = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const { id } = req.params;
    const { title, description, price, priceType, location, status, featured } =
      req.body;

    const listing = await updateListing(
      id,
      title,
      description,
      price,
      priceType,
      location,
      status,
      featured,
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: "Listing not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error("Error in updateListing controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update listing",
    });
  }
};

listingsController.deleteListing = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const { id } = req.params;

    const result = await deleteListing(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Listing not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Listing deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteListing controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete listing",
    });
  }
};

export default listingsController;
