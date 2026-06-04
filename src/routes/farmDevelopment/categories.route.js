import { Router } from "express";
import categoriesController from "../../controllers/farm-development/categories.controller.js";

const categoriesRouter = Router();

// GET /api/market-place/categories
categoriesRouter.get("/", categoriesController.getCategories);

export default categoriesRouter;
