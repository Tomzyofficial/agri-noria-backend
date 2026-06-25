import { createApplication } from "../../db/jobs/jobApplications.db.js";
import { validateJobApplication } from "../../lib/validations/validateJob.js";
import { AppError } from "../../utils/AppError.js";

export async function applyForJobController(req, res) {
  try {
    const cvFile = req.file;
    const schemaValidation = validateJobApplication.safeParse({
      ...req.body,
      cv_file: cvFile,
    });

    if (!schemaValidation.success) {
      const fieldErrors = schemaValidation.error.flatten().fieldErrors;
      const firstMsg = Object.values(fieldErrors).flat().filter(Boolean)[0];
      throw new AppError(`Validation failed: ${firstMsg}`, 400);
    }

    const application = await createApplication({
      ...schemaValidation.data,
      job_id: req.params.id,
      cv_file: cvFile,
    });

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: application,
    });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode
        ? error.message
        : "Internal server error. Try again later.",
    });
  }
}
