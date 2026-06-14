import pool from "../../lib/connect.js";
import { deleteFileFromCloudinary } from "../../lib/cloudinary.img.js";

export async function getPortfolioProjects(vendorId) {
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM farm_dev_portfolio_projects
       WHERE vendor_id = $1
       ORDER BY created_at DESC`,
      [vendorId],
    );
    return rows;
  } catch (error) {
    console.error("Database error in getPortfolioProjects:", error);
    return null;
  }
}

export async function createPortfolioProject(data) {
  try {
    const {
      vendorId,
      title,
      category,
      description,
      location,
      completion_date,
      featured_image,
      gallery_images,
      budget_range,
      client_type,
      project_duration,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO farm_dev_portfolio_projects (vendor_id, title, category, description, location, completion_date, featured_image, gallery_images,budget_range, client_type, project_duration
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        vendorId,
        title,
        category,
        description,
        location,
        completion_date,
        featured_image,
        gallery_images,
        budget_range,
        client_type,
        project_duration,
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
      "SELECT * FROM farm_dev_portfolio_projects WHERE id = $1",
      [projectId],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in getPortfolioProjectById:", error);
    return null;
  }
}

export async function getPortfolioProjectImages(projectId) {
  const project = await getPortfolioProjectById(projectId);
  return {
    beforeImages: project?.metadata?.beforeImages || [],
    afterImages: project?.metadata?.afterImages || [],
  };
}

export async function updatePortfolioProject(projectId, updates) {
  try {
    const {
      title,
      description,
      clientName,
      category,
      completionDate,
      featured,
      projectLocation,
      projectCostRange,
      clientType,
      beforeImages,
      afterImages,
      metadata,
    } = updates;

    const metadataPatch = {
      ...(metadata || {}),
      ...(projectCostRange ? { projectCostRange } : {}),
      ...(clientType ? { clientType } : {}),
      ...(beforeImages ? { beforeImages } : {}),
      ...(afterImages ? { afterImages } : {}),
    };

    const { rows } = await pool.query(
      `UPDATE farm_dev_portfolio_projects
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           client_name = COALESCE($3, client_name),
           category = COALESCE($4, category),
           completion_date = COALESCE($5, completion_date),
           featured = COALESCE($6, featured),
           project_location = COALESCE($7, project_location),
           metadata = metadata || COALESCE($8::jsonb, '{}'::jsonb),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        title,
        description,
        clientName,
        category,
        completionDate,
        featured,
        projectLocation,
        metadataPatch,
        projectId,
      ],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in updatePortfolioProject:", error);
    return null;
  }
}

export async function deletePortfolioProject(projectId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingImage = await client.query(
      "SELECT featured_image, gallery_images FROM farm_dev_portfolio_projects WHERE id = $1 LIMIT 1",
      [projectId],
    );

    if (existingImage.rows.length > 0) {
      await Promise.all([
        existingImage.rows[0].featured_image &&
          deleteFileFromCloudinary(existingImage.rows[0].featured_image),
        ...existingImage.rows[0].gallery_images.map((url) =>
          deleteFileFromCloudinary(url),
        ),
      ]);
    }
    const { rows } = await client.query(
      "DELETE FROM farm_dev_portfolio_projects WHERE id = $1 RETURNING id",
      [projectId],
    );
    await client.query("COMMIT");
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in deletePortfolioProject:", error);
    return null;
  }
}
