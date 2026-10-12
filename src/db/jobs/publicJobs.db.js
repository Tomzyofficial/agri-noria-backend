import pool from "../../lib/connect.js";

export async function getJobs({
  search = "",
  location = "",
  page = 1,
  limit = 12,
}) {
  const offset = (page - 1) * limit;

  const query = `
    SELECT j.id, j.title, j.employment_type, j.location_type, j.salary_min, j.salary_max
    FROM jobs j LEFT JOIN vendor_documents vd ON j.vendor_id = vd.vendor_id
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
    ORDER BY j.created_at DESC
    LIMIT $3 OFFSET $4
  `;

  const { rows } = await pool.query(query, [search, location, limit, offset]);

  return rows;
}

export async function getJobById(id) {
  const query = `
    SELECT j.*, vd.business_name, cu.country_code, cu.currency
    FROM jobs j
    LEFT JOIN vendor_documents vd ON j.vendor_id = vd.vendor_id
    LEFT JOIN country_utils cu ON j.vendor_id = cu.vendor_id
    WHERE j.id = $1
      AND j.status = 'active'
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [id]);
  return rows[0];
}
