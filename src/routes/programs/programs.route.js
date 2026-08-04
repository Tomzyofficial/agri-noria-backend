import express from "express";
import programsController from "../../controllers/programs/programs.controller.js";

const programsRoute = express.Router();

programsRoute.post("/programs/create", programsController.create);
programsRoute.get("/programs/notifications", programsController.getNotifications);
programsRoute.get("/programs/mine", programsController.getMyPrograms);
programsRoute.get("/programs", programsController.getAll);
programsRoute.post("/programs/:id/fund", programsController.fundProgram);
programsRoute.put("/programs/:id", programsController.update);

export default programsRoute;
