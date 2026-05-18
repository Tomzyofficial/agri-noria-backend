import "dotenv/config";
import express from "express";

import cors from "cors";

import cookieParser from "cookie-parser";

import vendorAuthRoute from "./routes/vendor/vendor.auth.route.js";
import buyerAuthRoute from "./routes/buyer/buyer.auth.route.js";
import marketplaceRoute from "./routes/marketplace.route.js";
import productListingRoute from "./routes/vendor/product.listing.route.js";
import cartOperationRoute from "./routes/buyer/cart.operation.route.js";
import profileRoute from "./routes/vendor/profile.route.js";
import checkoutRoute from "./routes/buyer/checkout.route.js";
import subPlansRoute from "./routes/vendor/sub.plans.route.js";
import storageRoute from "./routes/vendor/storage.facility.route.js";
import webhookRoute from "./routes/vendor/paystack.webhook.route.js";
import loanRoute from "./routes/vendor/loan.route.services.js";
import adminRoute from "./routes//admin.loan.route.js";
import trainingRoute from "./routes/vendor/training.route.js";
import superAdminRoute from "./routes/admin/super.admin.route.js";
import institutionAdminRoute from "./routes/admin/institution.admin.route.js";
import programsRoute from "./routes/programs/programs.route.js";
import pipelineRoute from "./routes/pipeline/pipeline.route.js";
import aggregatorRoute from "./routes/aggregator/aggregator.routes.js";
import stages12_15Route from "./routes/pipeline/stages-12-15.route.js";
import inputRequestRoute from "./routes/pipeline/input_request.route.js";
import trainingMaterialRoutes from "./routes/trainingMaterial.routes.js";

const port = process.env.PORT || 8080;

const app = express()
  .use(
    cors({
      origin: [
        "http://localhost:3000",
        "https://green-oria-agri-connect-frontend.vercel.app",
      ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["set-cookie", "Set-Cookie"],
    }),
  )
  .use(cookieParser())
  .use(express.json({ limit: "100mb" }))
  .use(express.urlencoded({ extended: true, limit: "100mb" }))
  .use("/api", vendorAuthRoute)
  .use("/api", buyerAuthRoute)
  .use("/api", marketplaceRoute)
  .use("/api/cart", cartOperationRoute)
  .use("/api", productListingRoute)
  .use("/api/vendor", profileRoute)
  .use("/api/summary", checkoutRoute)
  .use("/api/vendor", webhookRoute)
  .use("/api/vendor/subscription", subPlansRoute)
  .use("/api/vendor/storage", storageRoute)
  .use("/api/vendor/loan", loanRoute)
  .use("/api/aggregator", aggregatorRoute)
  .use("/api/vendor/training", trainingRoute)
  .use("/api/vendor", trainingMaterialRoutes)
  .use("/", adminRoute)
  .use("/api", superAdminRoute)
  .use("/api/admin/institution", institutionAdminRoute)
  .use("/api", programsRoute)
  .use("/api", pipelineRoute)
  .use("/api", stages12_15Route)
  .use("/api/inputs", inputRequestRoute);

app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});

export default app;
