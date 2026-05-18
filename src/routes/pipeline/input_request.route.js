import express from "express";
import inputRequestController from "../../controllers/pipeline/input_request.controller.js";

const inputRequestRoute = express.Router();

inputRequestRoute.post("/request", inputRequestController.createRequest);
inputRequestRoute.get("/my-requests", inputRequestController.getMyRequests);

export default inputRequestRoute;
