import * as fieldOpsDb from "../../db/pipeline/field-operations.db.js";

export const getInspections = async (req, res) => {
   try {
      const inspections = await fieldOpsDb.getInspections();
      res.status(200).json({ success: true, data: inspections });
   } catch (error) {
      console.error("Error getting inspections:", error);
      res.status(500).json({ success: false, message: "Server error" });
   }
};

export const createInspection = async (req, res) => {
   try {
      const { farmer_id, cluster_id, status, notes } = req.body;
      const officer_id = req.user?.id || req.body.officer_id;
      const newInspection = await fieldOpsDb.createInspection({ farmer_id, officer_id, cluster_id, status, notes });
      res.status(201).json({ success: true, data: newInspection });
   } catch (error) {
      console.error("Error creating inspection:", error);
      res.status(500).json({ success: false, message: "Server error" });
   }
};

export const getFarmers = async (req, res) => {
    try {
        const farmers = await fieldOpsDb.getFarmersForDropdown();
        res.status(200).json({ success: true, data: farmers });
    } catch (error) {
        console.error("Error getting farmers:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

export const getSchedules = async (req, res) => {
   try {
      const schedules = await fieldOpsDb.getSchedules();
      res.status(200).json({ success: true, data: schedules });
   } catch (error) {
      console.error("Error getting schedules:", error);
      res.status(500).json({ success: false, message: "Server error" });
   }
};

export const createSchedule = async (req, res) => {
   try {
      const { farm_id, visit_type, scheduled_date } = req.body;
      const officer_id = req.user?.id || req.body.officer_id;
      const newSchedule = await fieldOpsDb.createSchedule({ farm_id, visit_type, scheduled_date, officer_id });
      res.status(201).json({ success: true, data: newSchedule });
   } catch (error) {
      console.error("Error creating schedule:", error);
      res.status(500).json({ success: false, message: "Server error" });
   }
};

export const deleteSchedule = async (req, res) => {
   try {
      const { id } = req.params;
      const deleted = await fieldOpsDb.deleteSchedule(id);
      if (!deleted) {
         return res.status(404).json({ success: false, message: "Schedule not found" });
      }
      res.status(200).json({ success: true, data: deleted });
   } catch (error) {
      console.error("Error deleting schedule:", error);
      res.status(500).json({ success: false, message: "Server error" });
   }
};

export const getSettings = async (req, res) => {
   try {
      const vendor_id = req.user.id;
      const settings = await fieldOpsDb.getSettings(vendor_id);
      if (!settings) {
         return res.status(404).json({ success: false, message: "Settings not found" });
      }
      res.status(200).json({ success: true, data: settings });
   } catch (error) {
      console.error("Error getting settings:", error);
      res.status(500).json({ success: false, message: "Server error" });
   }
};

export const updateSettings = async (req, res) => {
   try {
      const vendor_id = req.user.id;
      const updated = await fieldOpsDb.updateSettings(vendor_id, req.body);
      res.status(200).json({ success: true, data: updated });
   } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ success: false, message: "Server error" });
   }
};
