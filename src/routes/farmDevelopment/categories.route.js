import { Router } from "express";
import categoriesController from "../../controllers/farmDevelopment/categories.controller.js";

const categoriesRouter = Router();

// GET /api/market-place/categories
categoriesRouter.get("/", categoriesController.getCategories);

export default categoriesRouter;
