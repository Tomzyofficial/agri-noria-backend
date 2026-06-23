import express from "express";
import bodyParser from "body-parser";
import { webhook } from "../../lib/services/paystack.webhook.js";

const webhookRoute = express.Router();

webhookRoute.post("/webhook", bodyParser.raw({ type: "application/json" }), webhook);

export default webhookRoute;
