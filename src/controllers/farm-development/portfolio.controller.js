import {
  getPortfolioProjects,
  createPortfolioProject,
  getPortfolioProjectById,
  getPortfolioProjectImages,
  updatePortfolioProject,
  deletePortfolioProject,
} from "../../db/farm-development/portfolio.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const portfolioController = {};

portfolioController.getPortfolioProjects = async (req, res) => {
  try {
    const companyId = req.query.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required",
      });
    }

    const projects = await getPortfolioProjects(companyId);

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
      companyId,
      title,
      description,
      clientName,
      category,
      completionDate,
    } = req.body;

    if (!companyId || !title) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: companyId, title",
      });
    }

    const project = await createPortfolioProject(
      companyId,
      title,
      description,
      clientName,
      category,
      completionDate,
    );

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
    const { id } = req.params;

    const project = await getPortfolioProjectById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Portfolio project not found",
      });
    }

    const images = await getPortfolioProjectImages(id);
    project.images = images;

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

    const { id } = req.params;
    const {
      title,
      description,
      clientName,
      category,
      completionDate,
      featured,
    } = req.body;

    const project = await updatePortfolioProject(
      id,
      title,
      description,
      clientName,
      category,
      completionDate,
      featured,
    );

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

    const { id } = req.params;

    const result = await deletePortfolioProject(id);

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
