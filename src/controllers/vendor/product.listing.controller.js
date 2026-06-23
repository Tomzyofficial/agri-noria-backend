import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import {
  fetchListedItems,
  filterItemForSearchParams,
  getTotalProducts,
  updateListings,
  createListingWithDetails,
  deleteProduct,
} from "../../db/vendor/product.listing.db.js";
import { saveFileToCloudinary } from "../../lib/cloudinary.img.js";

const productController = {};

// Add new item
productController.addProduct = async (req, res) => {
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
    const {
      listing_name,
      description,
      price,
      location,
      unit_measure,
      available_quantity,
      unit,
      min_quantity,
      category,
      discount,
      attributes,
    } = req.body;

    // file buffer from Multer
    const product_image = req.file;

    // Validate required common fields
    const requiredFields = [
      "listing_name",
      "description",
      "price",
      "location",
      "unit_measure",
      "available_quantity",
      "unit",
      "category",
    ];

    const missingCommon = requiredFields.filter((field) => !req.body[field]);
    if (missingCommon.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingCommon.join(", ")}`,
      });
    }

    // Parse attributes if sent as string
    let parsedAttributes = attributes;
    if (typeof attributes === "string") {
      try {
        parsedAttributes = JSON.parse(attributes);
      } catch (parseError) {
        console.error("Attributes parsing error:", parseError);
        return res.status(400).json({
          success: false,
          error: "Invalid attributes format.",
        });
      }
    }

    // upload to Cloudinary
    const productListing = await createListingWithDetails(
      payload.id,
      payload.account_type,
      product_image,
      listing_name,
      description,
      price,
      location,
      unit_measure,
      available_quantity,
      unit,
      min_quantity,
      category,
      discount,
      parsedAttributes || {},
    );

    if (!productListing.success) {
      return res.status(400).json({
        success: false,
        error: productListing.error || "Failed to create product listing",
      });
    }
    return res.status(201).json({
      success: true,
      message: "Product listed successfully",
      product: productListing.data,
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error. Try again later.",
    });
  }
};

// View listed product per product id
productController.viewItem = async (req, res) => {
  const payload = await verifyVendorToken(req);

  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const productId = req.params.id;

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, error: "Product ID is required" });
    }

    const itemViewOnly = await filterItemForSearchParams(payload.id, productId);
    //  console.log("items", itemViewOnly);

    if (!itemViewOnly) {
      // console.log("not true", itemViewOnly);
      return res
        .status(404)
        .json({ success: false, error: "Product not founds" });
    }
    //  console.log("true", itemViewOnly);

    return res.status(200).json({ success: true, product: itemViewOnly });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

// Edit listed product per product id
productController.editProduct = async (req, res) => {
  const payload = await verifyVendorToken(req);

  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const {
      product_id,
      listing_name,
      description,
      price,
      location,
      unit_measure,
      available_quantity,
      unit,
      min_quantity,
      category,
      discount,
      attributes,
    } = req.body;

    const product_image = req.file;

    // Parse attributes if sent as string
    let parsedAttributes = attributes;
    if (typeof attributes === "string") {
      try {
        parsedAttributes = JSON.parse(attributes);
      } catch (parseError) {
        console.error("Attributes parsing error:", parseError);
        return res.status(400).json({
          success: false,
          error: "Invalid attributes format.",
        });
      }
    }

    // Update unified listings table
    const listings = await updateListings(
      product_id,
      payload.id,
      product_image,
      listing_name,
      description,
      price,
      location,
      unit_measure,
      available_quantity,
      unit,
      min_quantity,
      category,
      discount,
      parsedAttributes || {},
    );

    if (!listings.success) {
      return res.status(400).json({
        success: false,
        error: listings.error || "Failed to update product listing",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: listings.data,
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error. Try again later.",
    });
  }
};

// Fetch listed products for user dashboard
productController.fetchListedProducts = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);

    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Fetch listed items based on account id
    const listedItems = await fetchListedItems(payload.id);

    if (!listedItems) {
      return res
        .status(204)
        .json({ success: false, error: "No listed produce here" });
    }

    return res.status(200).json({ success: true, listedItems: listedItems });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Error occurred: ${error}`,
    });
  }
};

// Get total listed products count
productController.productsTotal = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);

    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const total = await getTotalProducts(payload.id);

    return res.status(200).json({
      success: true,
      total: total,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

// Delete product per vendor
productController.deleteProduct = async (req, res) => {
  const payload = await verifyVendorToken(req);

  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const { id: productId } = req.params;
    const deleteResult = await deleteProduct(productId, payload);

    if (!deleteResult || !deleteResult.success) {
      return res.status(400).json({
        success: false,
        error: deleteResult?.error || "Failed to delete product",
      });
    }

    return res
      .status(200)
      .json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

export default productController;
