import express from "express";

import { getJobsController } from "../../controllers/jobs/publicJobs.controller.js";

import { applyForJobController } from "../../controllers/jobs/jobApplications.controller.js";

import { upload } from "../../middlewares/upload.js";

const publicJobRoute = express.Router();

publicJobRoute.get("/jobs", getJobsController);

publicJobRoute.post(
  "/api/jobs/:id/apply",
  upload.single("cv_file"),
  applyForJobController,
);

export default publicJobRoute;
