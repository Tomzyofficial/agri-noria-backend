import express from "express";
import { upload } from "../../middlewares/upload.js";
import trainingController from "../../controllers/vendor/training.controller.js";

const trainingRoute = express.Router();

trainingRoute.post(
  "/create",
  upload.single("thumbnail"),
  trainingController.createTraining,
);

trainingRoute.delete("/:trainingId", trainingController.deleteTraining);

trainingRoute.get("/overview", trainingController.getTrainingsByVendor);

trainingRoute.get("/list", trainingController.getTrainingsWithStatus);

trainingRoute.post(
  "/:trainingId/enroll",
  trainingController.enrollFarmerInTraining,
);

trainingRoute.get(
  "/total-enrollments",
  trainingController.countEnrolledFarmersByTrainer,
);

trainingRoute.get("/enrollments", trainingController.getFarmerEnrollmentsCount);

// Agora Live Session Routes
trainingRoute.post("/:trainingId/start", trainingController.startTraining);
trainingRoute.post("/:trainingId/end", trainingController.endTraining);
trainingRoute.post("/:trainingId/join", trainingController.joinTraining);

export default trainingRoute;
