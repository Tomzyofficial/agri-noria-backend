import { getAdminAllApplications, prepareLoanRepayment } from "../db/adminLoans.db.js";

export const disburseLoanController = async (req, res) => {
   try {
      const { loanId } = req.params;
      console.log("admin loan id", loanId);

      const result = await prepareLoanRepayment(loanId);

      if (!result || !result.success) {
         return res.status(400).json({
            success: false,
            error: result?.error || "Failed to disburse loan",
         });
      }

      res.status(200).json({
         success: true,
         message: "Loan disbursed and repayment schedule created",
         data: result.data,
      });
   } catch (error) {
      console.error("Loan disbursement error:", error);

      res.status(500).json({
         success: false,
         error: "Failed to disburse loan",
      });
   }
};

export const getLoans = async (_, res) => {
   try {
      const loans = await getAdminAllApplications();
      res.status(200).json({
         success: true,
         data: loans,
      });
   } catch (error) {
      console.error("Error fetching loans:", error);
      res.status(500).json({
         success: false,
         error: "Failed to fetch loans",
      });
   }
};
