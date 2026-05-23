const express = require("express");
const router = express.Router();
const serviceProvidersController = require("../controllers/service-providers.controller");

// Routes for service providers
router.get("/providers", serviceProvidersController.getAllProviders);
router.post("/providers", serviceProvidersController.createProvider);

// Routes for services
router.get("/services", serviceProvidersController.getAllServices);
router.post("/services", serviceProvidersController.createService);
router.delete("/services/:id", serviceProvidersController.deleteService);

module.exports = router;
