// routes/wallet.routes.js

import { Router } from "express";
import {
  getWalletSummary,
  getWalletTransactions,
  requestVendorWithdrawal,
} from "../../controllers/wallet.controller.js";

const walletRoute = Router();

walletRoute.get("/wallet/summary", getWalletSummary);
walletRoute.get("/wallet/transactions", getWalletTransactions);
walletRoute.post("/wallet/withdraw", requestVendorWithdrawal);

export default walletRoute;
