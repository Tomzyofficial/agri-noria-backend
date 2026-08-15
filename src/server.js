import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";

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
import webhookRoute from "./routes/webhooks/paystack.webhook.route.js";
import trainingRoute from "./routes/vendor/training.route.js";
import superAdminRoute from "./routes/admin/super.admin.route.js";
import institutionAdminRoute from "./routes/admin/institution.admin.route.js";
import programsRoute from "./routes/programs/programs.route.js";
import pipelineRoute from "./routes/pipeline/pipeline.route.js";
import aggregatorRoute from "./routes/aggregator/aggregator.routes.js";
import stages12_15Route from "./routes/pipeline/stages-12-15.route.js";
import inputRequestRoute from "./routes/pipeline/input_request.route.js";
import trainingMaterialRoutes from "./routes/trainingMaterial.routes.js";
import logisticsOperationRoute from "./routes/logisitics/logisticsOperation.route.js";
import paymentsRoute from "./routes/payments.route.js";
import ordersRoute from "./routes/buyer/orders.route.js";
import fieldOperationsRoute from "./routes/pipeline/field-operations.route.js";
import commodityOperationsRoute from "./routes/vendor/commodity-operations.routes.js";
import onboardingRoute from "./routes/vendor/onboarding.routes.js";
import uploadRoute from "./routes/vendor/upload.routes.js";
// import emailRoute from "./routes/email-verification.routes.js";
import listingsRoute from "./routes/farmDevelopment/listings.route.js";
import publicFarmDevelopmentRoute from "./routes/farmDevelopment/public.route.js";
import jobsRoute from "./routes/jobs/jobs.route.js";
import publicJobRoute from "./routes/jobs/publicJobs..route.js";
import droneRoute from "./routes/drone/listings.route.js";
import { startPendingBalanceReleaseJob } from "./jobs/release-pending-balance.js";
import { startWithdrawalReconciliationJob } from "./jobs/reconcile-withdrawals.js";
import walletRoute from "./routes/vendor/wallet.routes.js";
import bankroute from "./routes/bankAccount.route.js";
import adsRoute from "./modules/ads/routes/ads.vendor.routes.js";
import { startAdsScheduler } from "./jobs/adsScheduler.js";
import adsPublicRoute from "./modules/ads/routes/ads.public.routes.js";

const port = process.env.PORT || 5000;

const app = express()
  .use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://green-oria-agri-connect-frontend.vercel.app",
        "https://agri-noria-frontend.vercel.app",
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
  .use("/api/aggregator", aggregatorRoute)
  .use("/api/vendor/training", trainingRoute)
  .use("/api/vendor", trainingMaterialRoutes)
  .use("/api", superAdminRoute)
  .use("/api/admin/institution", institutionAdminRoute)
  .use("/api", programsRoute)
  .use("/api", pipelineRoute)
  .use("/api", stages12_15Route)
  .use("/api/inputs", inputRequestRoute)
  .use("/api/vendor/logistics", logisticsOperationRoute)
  .use("/api/buyer", paymentsRoute)
  .use("/api/buyer", ordersRoute)
  .use("/api/field-operations", fieldOperationsRoute)
  .use("/api/vendor/commodity-operations", commodityOperationsRoute)
  .use("/api/vendor/onboarding", onboardingRoute)
  .use("/api/vendor/upload", uploadRoute)
  //   .use("/api/email-verification", emailRoute)
  .use("/api/farm-development", listingsRoute)
  //   .use("/api/market-place/portfolio", portfolioRoute)
  .use("/api/farm-development/public", publicFarmDevelopmentRoute)
  .use("/api/vendor/jobs", jobsRoute)
  .use("/", publicJobRoute)
  .use("/api/vendor/drone", droneRoute)
  .use("/api/drone-marketplace", droneRoute)
  .use("/api/vendor", walletRoute)
  .use("/api/vendor", bankroute)
  .use("/api/vendor/ads", adsRoute)
  .use("/api/public", adsPublicRoute);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://green-oria-agri-connect-frontend.vercel.app",
      "https://agri-noria-frontend.vercel.app",
    ],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Client connected to socket:", socket.id);

  socket.on("join_cluster", (clusterId) => {
    socket.join(`cluster_${clusterId}`);
    console.log(`Socket ${socket.id} joined cluster_${clusterId}`);
  });

  socket.on("leave_cluster", (clusterId) => {
    socket.leave(`cluster_${clusterId}`);
    console.log(`Socket ${socket.id} left cluster_${clusterId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

app.set("io", io);

server.listen(port, () => {
  console.log(`Server listening on ${port}`);
  startPendingBalanceReleaseJob();
  startWithdrawalReconciliationJob();
  startAdsScheduler();
});

export default app;
