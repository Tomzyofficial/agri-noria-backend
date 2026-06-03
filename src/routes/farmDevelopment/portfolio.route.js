import { Router } from "express";
import portfolioController from "../../controllers/farmDevelopment/portfolio.controller.js";

const portfolioRouter = Router();

// GET /api/market-place/portfolio
portfolioRouter.get("/", portfolioController.getPortfolioProjects);

// POST /api/market-place/portfolio
portfolioRouter.post("/", portfolioController.createPortfolioProject);

// GET /api/market-place/portfolio/:id
portfolioRouter.get("/:id", portfolioController.getPortfolioProjectById);

// PATCH /api/market-place/portfolio/:id
portfolioRouter.patch("/:id", portfolioController.updatePortfolioProject);

// DELETE /api/market-place/portfolio/:id
portfolioRouter.delete("/:id", portfolioController.deletePortfolioProject);

export default portfolioRouter;
