import { Router } from "express";
import * as fieldOpsController from "../../controllers/pipeline/field-operations.controller.js";
import { requireVendorAuth } from "../../middlewares/vendorAuth.js";
import { auditLogger } from "../../middlewares/auditLogger.js";

const router = Router();

router.get("/inspections", fieldOpsController.getInspections);
router.post("/inspections", fieldOpsController.createInspection);

router.get("/farmers", fieldOpsController.getFarmers);

router.get("/schedule", fieldOpsController.getSchedules);
router.post("/schedule", fieldOpsController.createSchedule);
router.delete("/schedule/:id", fieldOpsController.deleteSchedule);

router.post("/register-farmer", requireVendorAuth, auditLogger('REGISTER_FARMER'), fieldOpsController.registerFarmer);
router.post("/enroll", requireVendorAuth, auditLogger('ENROLL_FARMER'), fieldOpsController.enrollFarmer);
router.get("/settings", requireVendorAuth, fieldOpsController.getSettings);
router.put("/settings", requireVendorAuth, fieldOpsController.updateSettings);

// --- Approvals, Assignments, Mapbox ---
router.get("/pending-approvals", requireVendorAuth, fieldOpsController.getPendingApprovals);
router.post("/approve-officer", requireVendorAuth, auditLogger('APPROVE_FIELD_OFFICER'), fieldOpsController.approveFieldOfficer);
router.get("/all-officers", requireVendorAuth, fieldOpsController.getAllFieldOfficers);
router.post("/suspend-officer", requireVendorAuth, auditLogger('SUSPEND_FIELD_OFFICER'), fieldOpsController.suspendFieldOfficer);
router.post("/work-assignments", requireVendorAuth, auditLogger('CREATE_WORK_ASSIGNMENT'), fieldOpsController.createWorkAssignment);
router.get("/work-assignments", requireVendorAuth, fieldOpsController.getWorkAssignments);

router.post("/capture-farm-boundary", requireVendorAuth, auditLogger('CAPTURE_FARM_BOUNDARY'), fieldOpsController.captureFarmBoundary);

export default router;
