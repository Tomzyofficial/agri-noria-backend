import express from "express";
import jobsController from "../../controllers/jobs/jobs.controller.js";

const jobsRoute = express.Router();

jobsRoute.post("/create", jobsController.createJob);

jobsRoute.get("/get-all", jobsController.getJobs);

jobsRoute.get("/get-applicants/:jobId", jobsController.getJobApplicantsByJobId);

jobsRoute.delete("/delete/:jobId", jobsController.deleteJob);

export default jobsRoute;
