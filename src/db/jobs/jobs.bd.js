import pool from "../../lib/connect.js";
export async function createJob(jobData) {
  const query = `
    INSERT INTO jobs (
      vendor_id,
      title,
      slug,
      category,
      custom_category,
      employment_type,
      openings,
      state,
      city,
      country,
      location_type,
      application_deadline,
      salary_type,
      salary_min,
      salary_max,
      experience_level,
      education_level,
      description,
      responsibilities,
      requirements,
      benefits
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,
      $19,$20,$21
    )
    RETURNING *;
  `;

  const values = [
    jobData.vendor_id,
    jobData.title,
    jobData.slug,
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
    SELECT * FROM jobs WHERE vendor_id = $1 ORDER BY created_at DESC;
   `;
  const { rows } = await pool.query(query, [vendorId]);
  return rows;
}
