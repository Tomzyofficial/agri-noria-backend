import {
  getLeads,
  createLead,
  getLeadById,
  getLeadStatusHistory,
  updateLeadStatus,
  deleteLead,
} from "../../db/farmDevelopment/leads.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const leadsController = {};

leadsController.getLeads = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const companyId = req.query.companyId;
    const status = req.query.status;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required",
      });
    }

    const leads = await getLeads(companyId, status);

    if (!leads) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch leads",
      });
    }

    return res.status(200).json({
      success: true,
      data: leads,
    });
  } catch (error) {
    console.error("Error in getLeads controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch leads",
    });
  }
};

leadsController.createLead = async (req, res) => {
  try {
    const {
      listingId,
      companyId,
      customerName,
      customerEmail,
      customerPhone,
      message,
      budget,
    } = req.body;

    if (!companyId || !customerName || !customerEmail) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: companyId, customerName, customerEmail",
      });
    }

    const lead = await createLead(
      listingId,
      companyId,
      customerName,
      customerEmail,
      customerPhone,
      message,
      budget,
    );

    if (!lead) {
      return res.status(500).json({
        success: false,
        error: "Failed to create lead",
      });
    }

    return res.status(201).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error("Error in createLead controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create lead",
    });
  }
};

leadsController.getLeadById = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const { id } = req.params;

    const lead = await getLeadById(id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    const history = await getLeadStatusHistory(id);
    lead.status_history = history;

    return res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error("Error in getLeadById controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch lead",
    });
  }
};

leadsController.updateLeadStatus = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    const lead = await updateLeadStatus(id, status);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error("Error in updateLeadStatus controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update lead",
    });
  }
};

leadsController.deleteLead = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const { id } = req.params;

    const result = await deleteLead(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteLead controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete lead",
    });
  }
};

export default leadsController;
