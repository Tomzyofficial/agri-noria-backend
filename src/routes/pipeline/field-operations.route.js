import { Router } from "express";
import * as fieldOpsController from "../../controllers/pipeline/field-operations.controller.js";
import { requireVendorAuth } from "../../middlewares/vendorAuth.js";

const router = Router();

router.get("/inspections", fieldOpsController.getInspections);
router.post("/inspections", fieldOpsController.createInspection);

router.get("/farmers", fieldOpsController.getFarmers);

router.get("/schedule", fieldOpsController.getSchedules);
router.post("/schedule", fieldOpsController.createSchedule);
router.delete("/schedule/:id", fieldOpsController.deleteSchedule);

router.get("/settings", requireVendorAuth, fieldOpsController.getSettings);
router.put("/settings", requireVendorAuth, fieldOpsController.updateSettings);

export default router;
