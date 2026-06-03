import {
  getCompany,
  createCompany,
  updateCompany,
} from "../../db/farmDevelopment/company.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const companyController = {};

companyController.getCompany = async (req, res) => {
  try {
    const companyId = req.query.id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required",
      });
    }

    const company = await getCompany(parseInt(companyId));

    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error("Error in getCompany controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch company",
    });
  }
};

companyController.createCompany = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const {
      name,
      description,
      website,
      phone,
      email,
      address,
      city,
      state,
      zipCode,
      country,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Company name is required",
      });
    }

    const company = await createCompany(
      payload.id,
      name,
      description,
      website,
      phone,
      email,
      address,
      city,
      state,
      zipCode,
      country,
    );

    if (!company) {
      return res.status(500).json({
        success: false,
        error: "Failed to create company",
      });
    }

    return res.status(201).json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error("Error in createCompany controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create company",
    });
  }
};

companyController.updateCompany = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const {
      id,
      name,
      description,
      website,
      phone,
      email,
      address,
      city,
      state,
      zipCode,
      country,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required",
      });
    }

    const company = await updateCompany(
      parseInt(id),
      name,
      description,
      website,
      phone,
      email,
      address,
      city,
      state,
      zipCode,
      country,
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error("Error in updateCompany controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update company",
    });
  }
};

export default companyController;
