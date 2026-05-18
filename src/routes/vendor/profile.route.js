import express from "express";

import profileController from "../../controllers/vendor/profile.controller.js";
import { upload } from "../../middlewares/upload.js";
const profileRoute = express.Router();

// Vendor verification
profileRoute.get("/verification", profileController.isVendorVerified);

// Vendor profile info
profileRoute.get("/get-profile-info", profileController.profileInfo);

// Vendor profile image
profileRoute.get("/get-profile-image", profileController.getProfileImage);

// Vendor profile image upload
profileRoute.patch("/upload-profile-image", upload.single("profile_image"), profileController.uploadProfileImage);

// Handle multiple file uploads for documents (id_front_url, id_back_url, license_url)
profileRoute.post(
   "/edit-profile",
   upload.fields([
      { name: "id_front_url", maxCount: 1 },
      { name: "id_back_url", maxCount: 1 },
      { name: "license_url", maxCount: 1 },
   ]),
   profileController.editProfile,
);

// Vendor product ratings
profileRoute.get("/product-ratings", profileController.ratings);

// Complete onboarding
profileRoute.post("/complete-onboarding", profileController.completeOnboarding);

export default profileRoute;
