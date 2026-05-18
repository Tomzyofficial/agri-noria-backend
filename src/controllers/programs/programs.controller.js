import { createProgram, getAllPrograms, getProgramsByCreator } from "../../db/programs/programs.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const programsController = {};

// Create program (Institution only)
programsController.create = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { name, region, commodity } = req.body;
      if (!name || !region || !commodity) {
         return res.status(400).json({ success: false, error: "Name, region, and commodity are required" });
      }

      const program = await createProgram({
         ...req.body,
         created_by: payload.id,
      });

      return res.status(201).json({ success: true, data: program });
   } catch (error) {
      console.error("Error creating program:", error);
      return res.status(500).json({ success: false, error: "Failed to create program" });
   }
};

// Get all programs
programsController.getAll = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const programs = await getAllPrograms();
      return res.status(200).json({ success: true, data: programs });
   } catch (error) {
      console.error("Error fetching programs:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch programs" });
   }
};

// Get my programs (for institution users)
programsController.getMyPrograms = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const programs = await getProgramsByCreator(payload.id);
      return res.status(200).json({ success: true, data: programs });
   } catch (error) {
      console.error("Error fetching my programs:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch programs" });
   }
};

// Update program (Creator only)
programsController.update = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { id } = req.params;
      const existing = await getProgramById(id);

      if (!existing) {
         return res.status(404).json({ success: false, error: "Program not found" });
      }

      if (existing.created_by !== payload.id) {
         return res.status(403).json({ success: false, error: "Forbidden: Only the creator can modify this program" });
      }

      const updated = await updateProgram(id, req.body);
      return res.status(200).json({ success: true, data: updated });
   } catch (error) {
      console.error("Error updating program:", error);
      return res.status(500).json({ success: false, error: "Failed to update program" });
   }
};

export default programsController;
