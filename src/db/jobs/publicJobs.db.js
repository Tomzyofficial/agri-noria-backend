import pool from "../../lib/connect.js";

export async function getJobs({
  search = "",
  location = "",
  page = 1,
  limit = 12,
}) {
  const offset = (page - 1) * limit;

  const query = `
    SELECT j.id, j.title, j.category, j.city, j.state, j.employment_type, j.salary_min,
      j.salary_max, j.created_at, j.description, j.requirements, j.benefits, vd.business_name
    FROM jobs j
    LEFT JOIN vendor_documents vd ON j.vendor_id = vd.vendor_id
    WHERE j.status = 'active'
      AND (
         $1 = '' OR j.title ILIKE '%' || $1 || '%'
         OR $1 = '' OR j.category ILIKE '%' || $1 || '%'
         OR $1 = '' OR vd.business_name ILIKE '%' || $1 || '%'
         )
      AND (
        $2 = ''
        OR city ILIKE '%' || $2 || '%'
        OR state ILIKE '%' || $2 || '%'
        OR CONCAT(city, ', ', state) ILIKE '%' || $2 || '%'
        OR country ILIKE '%' || $2 || '%'
      )
    ORDER BY created_at DESC
    LIMIT $3 OFFSET $4
  `;

  const { rows } = await pool.query(query, [search, location, limit, offset]);

  return rows;
}

export async function getJobBySlug(slug) {
  const query = `
    SELECT j.*, vd.business_name
    FROM jobs j
    LEFT JOIN vendor_details vd ON j.vendor_id = vd.user_id
    WHERE j.slug = $1
      AND j.status = 'active'
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [slug]);

  return rows[0];
}
