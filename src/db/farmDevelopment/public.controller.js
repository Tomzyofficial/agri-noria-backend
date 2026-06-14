// Get all public jobs
import { getJobsPulicPlace } from "../jobs/public.db.js";

const publicJobs = {};

publicJobs.getAllJobs = async () => {
  try {
    const result = await getJobsPulicPlace();

    return { success: true, data: result };
  } catch (error) {
    console.error("error at the public controller jobs", error);
    return res
      .status(500)
      .json({ error: "Failed to retrieve data", success: false });
  }
};
