import express from "express";
import productController from "../../controllers/vendor/product.listing.controller.js";
import { upload } from "../../middlewares/upload.js";
const productListingRoute = express.Router();

// Get total listed products per vendor
productListingRoute.get(
  "/vendor/products/total",
  productController.productsTotal,
);

// Fetch listed products for vendor dashboard
productListingRoute.get(
  "/vendor/products/listed",
  productController.fetchListedProducts,
);

// Edit product per listing id
productListingRoute.patch(
  "/vendor/products/edit-item",
  upload.fields([{ name: "image", maxCount: 5 }]),
  productController.editProduct,
);

// Create a new product
productListingRoute.post(
  "/vendor/products/add-item",
  upload.fields([{ name: "image", maxCount: 5 }]),
  productController.addProduct,
);

// Delete product per vendor
productListingRoute.delete(
  "/vendor/products/delete-item/:id",
  productController.deleteProduct,
);

// View item for search params
productListingRoute.get(
  "/vendor/products/view-item/:id",
  productController.viewItem,
);

export default productListingRoute;
