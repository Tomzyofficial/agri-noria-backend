import express from "express";
import storage_facilities from "../../controllers/vendor/storage.facility.controller.js";
import { upload } from "../../middlewares/upload.js";

const storageRoute = express.Router();

// Create new storage facility
storageRoute.post("/add-storage", upload.single("storage_image"), storage_facilities.create);

// Get listed storage facilities
storageRoute.get("/fetch-listed-storage", storage_facilities.listedStorage);

// Get total storage facilities
storageRoute.get("/get-total-storage", storage_facilities.getTotalStorage);

// View item for search params
storageRoute.get("/view-item/:id", storage_facilities.viewItem);

// Edit storage facility per listing id
storageRoute.patch("/edit-item", upload.single("storage_image"), storage_facilities.editStorage);

// Delete storage facility per vendor
storageRoute.delete("/delete-item/:id", storage_facilities.deleteStorage);

export default storageRoute;
