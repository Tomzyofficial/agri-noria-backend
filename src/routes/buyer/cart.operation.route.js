import express from "express";
import buyerCartController from "../../controllers/buyer/cart.operation.controller.js";
const cartOperationRoute = express.Router();

cartOperationRoute.post("/cart-merge", buyerCartController.cartMerge);

cartOperationRoute.post("/sync", buyerCartController.sync);

// POST /api/cart/operations for logged in user
cartOperationRoute.post("/operations", buyerCartController.operations);

cartOperationRoute.get("/get", buyerCartController.get);

cartOperationRoute.post("/set", buyerCartController.set);

export default cartOperationRoute;
