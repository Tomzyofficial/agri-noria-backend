import { getJobs } from "../../db/jobs/publicJobs.db.js";

export async function getJobsController(req, res) {
  try {
    const jobs = await getJobs(req.query);

    return res.status(200).json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch jobs",
    });
  }
}

// export async function getJobController(req, res) {
//   try {
//     const job = await getJobBySlug(req.params.slug);

//     if (!job) {
//       return res.status(404).json({
//         success: false,
//         message: "Job not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       data: job,
//     });
//   } catch (error) {
//     console.error(error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch job",
//     });
//   }
// }
