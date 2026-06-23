import { deleteFileFromCloudinary } from "../../lib/cloudinary.img.js";
import pool from "../../lib/connect.js";
export async function createJob(jobData) {
  const query = `
    INSERT INTO jobs (
      vendor_id, title, category, custom_category, employment_type, openings, state, city, country, location_type,
      application_deadline, salary_type, salary_min, salary_max, experience_level, education_level, description,
      responsibilities, requirements, benefits) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
    )
    RETURNING *;
  `;

  const values = [
    jobData.vendor_id,
    jobData.title,
    jobData.category,
    jobData.customCategory || null,
    jobData.employmentType,
    jobData.openings,
    jobData.state,
    jobData.city,
    jobData.country,
    jobData.locationType,
    jobData.deadline,
    jobData.salaryType,
    jobData.salaryMin,
    jobData.salaryMax,
    jobData.experienceLevel,
    jobData.educationLevel,
    jobData.description,
    jobData.responsibilities,
    jobData.requirements,
    jobData.benefits,
  ];

  const { rows } = await pool.query(query, values);

  return rows[0];
}

// get job posting per vendor
export async function getJobsByVendor(vendorId) {
  const query = `
    SELECT id, title, state, city, applicants_count, status, created_at FROM jobs WHERE vendor_id = $1 ORDER BY created_at DESC;
   `;
  const { rows } = await pool.query(query, [vendorId]);
  return rows;
}

export async function getJobStats(vendorId) {
  const jobStats =
    "SELECT COUNT(*) AS total_jobs, SUM(COALESCE(applicants_count, 0)) AS total_applicants FROM jobs WHERE vendor_id = $1 ";
  const { rows: statsRows } = await pool.query(jobStats, [vendorId]);
  return statsRows[0];
}

export async function deleteJob(jobId, vendorId) {
  const existing = await pool.query(
    `SELECT ja.cv_file FROM job_applications ja JOIN jobs j ON j.id = ja.job_id WHERE j.id = $1 AND j.vendor_id = $2 AND ja.cv_file IS NOT NULL`,
    [jobId, vendorId],
  );

  if (existing.rows.length > 0) {
    console.log("CV file exists");
    await deleteFileFromCloudinary(existing.rows[0].cv_file);
  } else {
    console.log("No CV file exists");
  }

  await pool.query("DELETE FROM jobs WHERE id = $1 AND vendor_id = $2", [
    jobId,
    vendorId,
  ]);
}

export async function getJobApplicantsByJobId(jobId) {
  const query = "SELECT * FROM job_applications WHERE job_id = $1";
  const { rows } = await pool.query(query, [jobId]);
  return rows;
}
