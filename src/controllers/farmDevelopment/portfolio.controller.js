import {
  createPortfolioProject,
  deletePortfolioProject,
  getPortfolioProjectById,
  getPortfolioProjects,
  updatePortfolioProject,
} from "../../db/farmDevelopment/portfolio.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import { saveFileToCloudinary } from "../../lib/cloudinary.img.js";

const portfolioController = {};

portfolioController.getPortfolioProjects = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const projects = await getPortfolioProjects(payload.id);

    if (!projects) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch portfolio projects",
      });
    }

    return res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("Error in getPortfolioProjects controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch portfolio projects",
    });
  }
};

portfolioController.createPortfolioProject = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const {
      title,
      category,
      description,
      location,
      completion_date,
      budget_range,
      client_type,
      project_duration,
    } = req.body;
    const featured_image = req.files?.featured_image?.[0] || null;
    const gallery_images = req.files?.gallery_images || [];

    if (!title || !category || !featured_image || !description) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: title, category, featured image",
      });
    }

    if (!featured_image) {
      return res
        .status(400)
        .json({ success: false, error: "Featured image is required" });
    }

    const saveFeaturedImage = featured_image
      ? await saveFileToCloudinary(
          featured_image,
          "farm_dev_portfolio_featured_images",
          "image",
        )
      : null;

    const saveGalleryImages = gallery_images.length
      ? await saveFileToCloudinary(
          gallery_images,
          "farm_dev_portfolio_gallery_images",
          "image",
        )
      : [];

    const portfolioData = {
      vendorId: payload.id,
      title,
      category,
      description,
      location,
      completion_date,
      featured_image: saveFeaturedImage?.secure_url || "",
      gallery_images: Array.isArray(saveGalleryImages)
        ? saveGalleryImages
            .map((image) => image.secure_url || "")
            .filter(Boolean)
        : saveGalleryImages?.secure_url
          ? [saveGalleryImages.secure_url]
          : [],
      budget_range,
      client_type,
      project_duration,
    };

    const project = await createPortfolioProject(portfolioData);

    if (!project) {
      return res.status(500).json({
        success: false,
        error: "Failed to create portfolio project",
      });
    }

    return res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Error in createPortfolioProject controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create portfolio project",
    });
  }
};

portfolioController.getPortfolioProjectById = async (req, res) => {
  try {
    const project = await getPortfolioProjectById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Portfolio project not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Error in getPortfolioProjectById controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch portfolio project",
    });
  }
};

portfolioController.updatePortfolioProject = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const project = await updatePortfolioProject(req.params.id, req.body);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Portfolio project not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Error in updatePortfolioProject controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update portfolio project",
    });
  }
};

portfolioController.deletePortfolioProject = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const result = await deletePortfolioProject(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Portfolio project not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Portfolio project deleted successfully",
    });
  } catch (error) {
    console.error("Error in deletePortfolioProject controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete portfolio project",
    });
  }
};

export default portfolioController;
