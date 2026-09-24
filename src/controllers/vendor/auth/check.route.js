import { checkOnboardingStatus } from "./check.controller.js";
import router from "express";

const CheckRouter = router.Router();

// Route to check vendor onboarding status
CheckRouter.get("/onboarding-status", checkOnboardingStatus);

export default CheckRouter;
