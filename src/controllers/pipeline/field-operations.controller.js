import * as fieldOpsDb from "../../db/pipeline/field-operations.db.js";
import { getUserByEmail, createUser } from "../../db/vendor/vendor.auth.db.js";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

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

export const getPendingApprovals = async (req, res) => {
    try {
        const approvals = await fieldOpsDb.getPendingApprovals();
        res.status(200).json({ success: true, data: approvals });
    } catch (error) {
        console.error("Error getting pending approvals:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const approveFieldOfficer = async (req, res) => {
    try {
        const { vendorId, status } = req.body;
        const result = await fieldOpsDb.approveFieldOfficer(vendorId, status);
        
        if (req.logAudit) {
           await req.logAudit({
              resource: 'vendors',
              previousValue: { approval_status: 'pending_approval' },
              newValue: { approval_status: status },
              specificActionType: 'APPROVE_FIELD_OFFICER'
           });
        }
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error("Error approving officer:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getAllFieldOfficers = async (req, res) => {
    try {
        const officers = await fieldOpsDb.getAllFieldOfficers();
        res.status(200).json({ success: true, data: officers });
    } catch (error) {
        console.error("Error getting all officers:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const suspendFieldOfficer = async (req, res) => {
    try {
        const { vendorId, isSuspended } = req.body;
        const result = await fieldOpsDb.suspendFieldOfficer(vendorId, isSuspended);
        
        if (req.logAudit) {
           await req.logAudit({
              resource: 'vendors',
              newValue: { is_suspended: isSuspended },
              specificActionType: 'SUSPEND_FIELD_OFFICER'
           });
        }
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error("Error suspending officer:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const createWorkAssignment = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const { officerId, community, ward, lga, zone, target } = req.body;
        const assignment = await fieldOpsDb.createWorkAssignment(supervisorId, officerId, community, ward, lga, zone, target);
        
        if (req.logAudit) {
           await req.logAudit({
              resource: 'work_assignments',
              newValue: assignment,
              specificActionType: 'CREATE_WORK_ASSIGNMENT'
           });
        }

        res.status(201).json({ success: true, data: assignment });
    } catch (error) {
        console.error("Error creating assignment:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getWorkAssignments = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const role = req.user.role;
        const assignments = await fieldOpsDb.getWorkAssignments(vendorId, role);
        res.status(200).json({ success: true, data: assignments });
    } catch (error) {
        console.error("Error getting assignments:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const captureFarmBoundary = async (req, res) => {
    try {
        const { farmerId, polygon, hectares, lat, lng } = req.body;
        const result = await fieldOpsDb.captureFarmBoundary(farmerId, polygon, hectares, lat, lng);
        
        if (req.logAudit) {
           await req.logAudit({
              resource: 'farms',
              newValue: { boundary_polygon: polygon, farm_size_hectares: hectares, latitude: lat, longitude: lng },
              specificActionType: 'CAPTURE_FARM_BOUNDARY'
           });
        }

        res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error("Error capturing farm boundary:", error);
      res.status(500).json({ success: false, message: "Server error" });
   }
};

export const registerFarmer = async (req, res) => {
   try {
      const { fname, lname, email, phone, pword } = req.body;
      
      const existingVendor = await getUserByEmail(email);
      if (existingVendor) {
         return res.status(409).json({ success: false, error: ["Email address already in use."] });
      }

      const hashedPassword = await bcrypt.hash(pword || "Farmer123!", SALT_ROUNDS);
      const terms_of_service = true;
      const workspace = "ecosystem";
      const role = "farmer";
      const approval_status = "pending_approval";

      const newVendor = await createUser(
         fname,
         lname,
         email,
         phone,
         hashedPassword,
         terms_of_service,
         workspace,
         role,
         approval_status
      );

      if (!newVendor) {
         return res.status(400).json({ success: false, error: ["Failed to create farmer account."] });
      }

      res.status(201).json({ success: true, message: "Farmer successfully registered. Pending field approval." });
   } catch (error) {
      console.error("Error registering farmer:", error);
      res.status(500).json({ success: false, error: ["Server error"] });
   }
};

export const enrollFarmer = async (req, res) => {
   try {
      const { farmerId, programId } = req.body;
      if (!farmerId || !programId) {
         return res.status(400).json({ success: false, message: "farmerId and programId are required" });
      }
      
      const enrolledBy = req.user?.id;
      const result = await fieldOpsDb.enrollFarmerInProgram(farmerId, programId, enrolledBy);
      
      if (req.logAudit) {
         await req.logAudit({
            resource: 'farmer_programmes',
            newValue: result,
            specificActionType: 'ENROLL_FARMER'
         });
      }
      
      res.status(200).json({ success: true, data: result });
   } catch (error) {
      console.error("Error enrolling farmer:", error);
      res.status(500).json({ success: false, message: "Server error" });
   }
};
