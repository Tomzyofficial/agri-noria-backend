import express from "express";
import programsController from "../../controllers/programs/programs.controller.js";

const programsRoute = express.Router();

programsRoute.post("/programs/create", programsController.create);
programsRoute.get("/programs", programsController.getAll);
programsRoute.get("/programs/mine", programsController.getMyPrograms);
programsRoute.put("/programs/:id", programsController.update);

export default programsRoute;
