import { success } from "zod";
import { createJob, getJobsByVendor } from "../../db/jobs/jobs.bd.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
const jobsController = {};

jobsController.createJob = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    const vendor_id = payload.id;
    const {
      title,
      category,
      customCategory,
      employmentType,
      openings,
      state,
      city,
      country,
      locationType,
      deadline,
      salaryType,
      salaryMin,
      salaryMax,
      experienceLevel,
      educationLevel,
      description,
      responsibilities,
      requirements,
      benefits,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Job title is required",
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Job description is required",
      });
    }

    const slug = `${title}-${Date.now()}`;

    const job = await createJob({
      vendor_id,
      title,
      slug,
      category,
      customCategory,
      employmentType,
      openings,
      state,
      city,
      country,
      locationType,
      deadline,
      salaryType,
      salaryMin,
      salaryMax,
      experienceLevel,
      educationLevel,
      description,
      responsibilities,
      requirements,
      benefits,
    });

    return res.status(201).json({
      success: true,
      message: "Job created successfully",
      data: job,
    });
  } catch (error) {
    console.error("Create Job Controller Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create job",
    });
  }
};

jobsController.getJobs = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);

    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const vendor_id = payload.id;

    const jobs = await getJobsByVendor(vendor_id);

    return res.status(200).json({
      success: true,
      message: "Jobs retrieved successfully",
      data: jobs,
    });
  } catch (error) {
    console.error("Get Jobs By Vendor Controller Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve jobs",
    });
  }
};

export default jobsController;
