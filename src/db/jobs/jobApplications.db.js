import pool from "../../lib/connect.js";
import { AppError } from "../../utils/AppError.js";
import { saveFileToCloudinary } from "../../lib/cloudinary.img.js";

export async function createApplication(data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT 1 FROM job_applications WHERE job_id = $1 AND email = $2",
      [data.job_id, data.email],
    );
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      throw new AppError("You have already applied for this job", 409);
    }

    const query = `
    INSERT INTO job_applications (
      job_id,
      full_name,
      email,
      phone,
      state,
      city,
      country,
      experience_level,
      education_level,
      cover_letter,
      linkedin_url
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    )
    RETURNING *
  `;

    const { rows } = await client.query(query, [
      data.job_id,
      data.full_name,
      data.email,
      data.phone,
      data.state,
      data.city,
      data.country,
      data.experience_level,
      data.education_level,
      data.cover_letter,
      data.linkedin_url,
    ]);

    if (data.cv_file) {
      const cvUrl = await saveFileToCloudinary(
        data.cv_file,
        "job_cv_files",
        "raw",
      );
      await client.query(
        "UPDATE job_applications SET cv_file = $1 WHERE id = $2",
        [cvUrl.secure_url, rows[0].id],
      );
    }

    if (rows[0].id) {
      await client.query(
        "UPDATE jobs SET applicants_count = applicants_count + 1 WHERE id = $1",
        [data.job_id],
      );
    }

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
