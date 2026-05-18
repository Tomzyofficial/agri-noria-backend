import express from "express";
import productController from "../../controllers/vendor/product.listing.controller.js";
import { upload } from "../../middlewares/upload.js";
const productListingRoute = express.Router();

// Get total listed products per vendor
productListingRoute.get("/vendor/products/total", productController.productsTotal);

// Fetch listed products for vendor dashboard
productListingRoute.get("/vendor/products/listed", productController.fetchListedProducts);

// View item for search params
productListingRoute.get("/vendor/products/view-item/:id", productController.viewItem);

// Edit product per listing id
productListingRoute.patch("/vendor/products/edit-item", upload.single("product_image"), productController.editProduct);

// Create a new product
productListingRoute.post("/vendor/products/add-item", upload.single("product_image"), productController.addProduct);

// Delete product per vendor
productListingRoute.delete("/vendor/products/delete-item/:id", productController.deleteProduct);

export default productListingRoute;
