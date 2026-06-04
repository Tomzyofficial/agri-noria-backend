import pool from "../../lib/connect.js";

export async function getPortfolioProjects(companyId) {
  try {
    const query = `
      SELECT 
        p.id, p.company_id, p.title, p.description, p.client_name,
        p.category, p.completion_date, p.featured, p.created_at, p.updated_at,
        array_agg(pi.image_url) as images
      FROM portfolio_projects p
      LEFT JOIN portfolio_images pi ON p.id = pi.project_id
      WHERE p.company_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    const { rows } = await pool.query(query, [parseInt(companyId)]);
    return rows;
  } catch (error) {
    console.error("Database error in getPortfolioProjects:", error);
    return null;
  }
}

export async function createPortfolioProject(
  companyId,
  title,
  description,
  clientName,
  category,
  completionDate,
) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO portfolio_projects (company_id, title, description, client_name, category, completion_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        companyId,
        title,
        description || "",
        clientName || "",
        category || "",
        completionDate || null,
      ],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in createPortfolioProject:", error);
    return null;
  }
}

export async function getPortfolioProjectById(projectId) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM portfolio_projects WHERE id = $1",
      [parseInt(projectId)],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in getPortfolioProjectById:", error);
    return null;
  }
}

export async function getPortfolioProjectImages(projectId) {
  try {
    const { rows } = await pool.query(
      "SELECT id, image_url, alt_text, display_order FROM portfolio_images WHERE project_id = $1 ORDER BY display_order",
      [parseInt(projectId)],
    );
    return rows;
  } catch (error) {
    console.error("Database error in getPortfolioProjectImages:", error);
    return [];
  }
}

export async function updatePortfolioProject(
  projectId,
  title,
  description,
  clientName,
  category,
  completionDate,
  featured,
) {
  try {
    const { rows } = await pool.query(
      `UPDATE portfolio_projects 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           client_name = COALESCE($3, client_name),
           category = COALESCE($4, category),
           completion_date = COALESCE($5, completion_date),
           featured = COALESCE($6, featured),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        title,
        description,
        clientName,
        category,
        completionDate,
        featured,
        parseInt(projectId),
      ],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in updatePortfolioProject:", error);
    return null;
  }
}

export async function deletePortfolioProject(projectId) {
  try {
    // Delete images first
    await pool.query("DELETE FROM portfolio_images WHERE project_id = $1", [
      parseInt(projectId),
    ]);
    // Delete project
    const { rows } = await pool.query(
      "DELETE FROM portfolio_projects WHERE id = $1 RETURNING id",
      [parseInt(projectId)],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in deletePortfolioProject:", error);
    return null;
  }
}
