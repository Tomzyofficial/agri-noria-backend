import express from "express";

import {
  getJobsController,
  getJobByIdController,
} from "../../controllers/jobs/publicJobs.controller.js";

import { applyForJobController } from "../../controllers/jobs/jobApplications.controller.js";

import { upload } from "../../middlewares/upload.js";

const publicJobRoute = express.Router();

publicJobRoute.get("/jobs", getJobsController);

publicJobRoute.get("/jobs/:id", getJobByIdController);

publicJobRoute.post(
  "/api/jobs/:id/apply",
  upload.single("cv_file"),
  applyForJobController,
);

export default publicJobRoute;
