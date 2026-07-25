import pool from "../../lib/connect.js";
import {
  deleteFileFromCloudinary,
  saveFileToCloudinary,
} from "../../lib/cloudinary.img.js";

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
      `INSERT INTO farm_dev_portfolio_projects (vendor_id, title, category, description, location, completion_date, featured_image, gallery_images, budget_range, client_type, project_duration
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

export async function updatePortfolioProject(projectId, vendorId, updates) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingProject = await client.query(
      `
        SELECT featured_image, gallery_images
        FROM farm_dev_portfolio_projects
        WHERE id = $1
        AND vendor_id = $2
        LIMIT 1
      `,
      [projectId, vendorId],
    );

    if (!existingProject.rows.length) {
      throw new Error("Portfolio project not found");
    }

    const current = existingProject.rows[0];

    let featuredImageUrl = null;
    let galleryImages = null;

    // FEATURED IMAGE
    if (updates.featured_image) {
      await deleteFileFromCloudinary(current.featured_image);

      const uploaded = await saveFileToCloudinary(
        updates.featured_image,
        "farm_dev_portfolio_featured_images",
        "image",
      );
      featuredImageUrl = uploaded.secure_url;
    }

    // GALLERY IMAGES
    if (
      Array.isArray(updates.gallery_images) &&
      updates.gallery_images.length > 0
    ) {
      const uploadedGallery = await Promise.all(
        updates.gallery_images.map((file) =>
          saveFileToCloudinary(
            file,
            "farm_dev_portfolio_gallery_images",
            "image",
          ),
        ),
      );

      galleryImages = [
        ...(current.gallery_images || []),
        ...uploadedGallery.map((img) => img.secure_url),
      ];
    }

    const { rows } = await client.query(
      `
        UPDATE farm_dev_portfolio_projects
        SET
          title = COALESCE($1, title),
          category = COALESCE($2, category),
          description = COALESCE($3, description),
          location = COALESCE($4, location),
          completion_date = COALESCE($5, completion_date),
          featured_image = COALESCE($6, featured_image),
          gallery_images = COALESCE($7, gallery_images),
          budget_range = COALESCE($8, budget_range),
          client_type = COALESCE($9, client_type),
          project_duration = COALESCE($10, project_duration),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        AND vendor_id = $12
        RETURNING *
      `,
      [
        updates.title,
        updates.category,
        updates.description,
        updates.location,
        updates.completion_date,
        featuredImageUrl,
        galleryImages,
        updates.budget_range,
        updates.client_type,
        updates.project_duration,
        projectId,
        vendorId,
      ],
    );

    await client.query("COMMIT");

    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Database error:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePortfolioProject(projectId, vendorId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingImage = await client.query(
      "SELECT featured_image, gallery_images FROM farm_dev_portfolio_projects WHERE id = $1  AND vendor_id = $2 LIMIT 1",
      [projectId, vendorId],
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
      "DELETE FROM farm_dev_portfolio_projects WHERE id = $1 AND vendor_id = $2 RETURNING id",
      [projectId, vendorId],
    );
    await client.query("COMMIT");
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in deletePortfolioProject:", error);
    return null;
  }
}
