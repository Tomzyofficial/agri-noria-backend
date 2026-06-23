import {
  createJob,
  getJobApplicantsByJobId,
  getJobsByVendor,
  getJobStats,
  deleteJob,
} from "../../db/jobs/jobs.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import { AppError } from "../../utils/AppError.js";
import { createJobSchema } from "../../lib/validations/validateJob.js";

const jobsController = {};
jobsController.createJob = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    const vendor_id = payload.id;
    const schemaValidation = createJobSchema.safeParse(req.body);

    if (!schemaValidation.success) {
      const fieldErrors = schemaValidation.error.issues.map(
        (issue) => issue.path[0],
      );
      throw new AppError(`Validation failed: ${fieldErrors.join(", ")}`, 400);
    }

    const data = schemaValidation.data;

    const job = await createJob({
      vendor_id,
      title: data.title,
      category: data.category,
      customCategory: data.customCategory,
      employmentType: data.employmentType,
      openings: data.openings,
      state: data.state,
      city: data.city,
      country: data.country,
      locationType: data.locationType,
      deadline: data.deadline,
      salaryType: data.salaryType,
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
      experienceLevel: data.experienceLevel,
      educationLevel: data.educationLevel,
      description: data.description,
      responsibilities: data.responsibilities,
      requirements: data.requirements,
      benefits: data.benefits,
    });

    return res.status(201).json({
      success: true,
      message: "Job created successfully",
      data: job,
    });
  } catch (error) {
    console.error("Create Job Controller Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Internal server error. Tryy again later.",
    });
  }
};

jobsController.getJobs = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);

    if (!payload) {
      throw new AppError("Unauthorized", 401);
    }
    const vendor_id = payload.id;

    const jobs = await Promise.all([
      getJobsByVendor(vendor_id),
      getJobStats(vendor_id),
    ]);

    return res.status(200).json({
      success: true,
      message: "Jobs retrieved successfully",
      jobsResult: jobs,
      jobs: jobs[0],
      stats: jobs[1],
    });
  } catch (error) {
    console.error("Get Jobs By Vendor Controller Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Internal server error.Try again later.",
    });
  }
};

jobsController.getJobApplicantsByJobId = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    const { jobId } = req.params;
    if (!payload) {
      throw new AppError("Unauthorized", 401);
    }

    const applicants = await getJobApplicantsByJobId(jobId);
    const response = {
      success: true,
      message: "Job applicants retrieved successfully",
      data: applicants,
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error("Get Job Applicant By Job Id Controller Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error. Try again later.",
    });
  }
};

jobsController.deleteJob = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    const { jobId } = req.params;
    if (!payload) {
      throw new AppError("Unauthorized", 401);
    }
    const vendor_id = payload.id;
    const job = await deleteJob(jobId, vendor_id);
    return res.status(200).json({
      success: true,
      message: "Job deleted successfully",
      data: job,
    });
  } catch (error) {
    console.error("Delete Job Controller Error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Failed to delete job",
    });
  }
};

export default jobsController;
