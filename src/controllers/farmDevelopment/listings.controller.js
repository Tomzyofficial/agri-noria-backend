import {
  createListing,
  deleteListing,
  getListingById,
  //   getListingImages,
  getListings,
  recordListingView,
  updateListing,
} from "../../db/farmDevelopment/listings.db.js";
import { saveFileToCloudinary } from "../../lib/cloudinary.img.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const listingsController = {};

listingsController.getListings = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const listings = await getListings(payload.id);

    if (!listings) {
      return res.status(404).json({
        success: false,
        error: "Failed to fetch listings. Listing not found.",
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
      title,
      category,
      description,
      location,
      scope,
      price_type,
      min_budget,
      max_budget,
      duration,
    } = req.body;

    // Validate required fields
    if (!title || !category || !description || !location) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: title, category, description, location",
      });
    }

    const featured_image = req.files?.featured_image?.[0] || null;
    const gallery_images = req.files?.gallery_images || [];

    if (!featured_image) {
      return res
        .status(400)
        .json({ success: false, error: "Featured image is required" });
    }

    const saveFeaturedImage = featured_image
      ? await saveFileToCloudinary(
          featured_image,
          "farm_dev_featured_images",
          "image",
        )
      : null;

    const saveGalleryImages = gallery_images.length
      ? await saveFileToCloudinary(
          gallery_images,
          "farm_dev_gallery_images",
          "image",
        )
      : [];

    try {
      // Construct the data object for the database function
      const vendorId = payload.id;
      const listingData = {
        vendorId,
        title,
        category,
        description,
        location,
        scope: scope ? JSON.parse(scope) : [],
        price_type: price_type,
        min_budget: min_budget ? parseInt(min_budget) : null,
        max_budget: max_budget ? parseInt(max_budget) : null,
        duration: duration || "",
        featured_image: saveFeaturedImage?.secure_url || "",
        gallery_images: Array.isArray(saveGalleryImages)
          ? saveGalleryImages
              .map((image) => image.secure_url || "")
              .filter(Boolean)
          : saveGalleryImages?.secure_url
            ? [saveGalleryImages.secure_url]
            : [],
      };

      const listing = await createListing(listingData);

      if (!listing) {
        return res.status(500).json({
          success: false,
          error: "Failed to create listing. Try again later.",
        });
      }

      return res.status(201).json({
        success: true,
        data: listing,
      });
    } catch (dbError) {
      console.error("Database error in createListing:", dbError);
      return res.status(500).json({
        success: false,
        error: "Failed to create listing",
      });
    }
  } catch (error) {
    console.error("Error in createListing controller:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error. Try again later.",
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

    const featured_image = req.files?.featured_image?.[0];
    const gallery_images = req.files?.gallery_images;

    let firstSave = null;
    let sec = null;
    firstSave = featured_image
      ? await saveFileToCloudinary(
          featured_image,
          "farm_dev_featured_images",
          "image",
        )
      : null;

    sec = Array.isArray(gallery_images)
      ? await saveFileToCloudinary(
          gallery_images,
          "farm_dev_gallery_images",
          "image",
        )
      : [];

    const updates = {
      ...req.body,
    };

    if (firstSave?.secure_url) {
      updates.featured_image = firstSave.secure_url;
    }

    if (Array.isArray(sec) && sec.length > 0) {
      updates.gallery_images = sec.map((img) => img.secure_url);
    }
    if (updates.scope) {
      updates.scope = JSON.parse(updates.scope);
    }
    const listing = await updateListing(id, payload.id, updates);

    if (listing.success === false) {
      return res.status(400).json({
        success: false,
        error: listing?.error || "Failed to update",
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
  const { id } = req.params;
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

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
