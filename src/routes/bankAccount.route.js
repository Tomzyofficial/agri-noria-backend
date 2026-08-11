// routes/bankAccount.routes.js

import { Router } from "express";
import {
  getBanks,
  getBankAccounts,
  addBankAccount,
  resolveBankAccount,
} from "../controllers/bankAccount.controller.js";

const bankRoute = Router();

bankRoute.get("/wallet/banks", getBanks);
bankRoute.get("/wallet/bank-accounts", getBankAccounts);
bankRoute.post("/wallet/bank-accounts", addBankAccount);
bankRoute.post("/wallet/bank-accounts/resolve", resolveBankAccount);

export default bankRoute;
