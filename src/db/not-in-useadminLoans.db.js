import pool from "../lib/connect.js";
export async function getAdminAllApplications() {
   try {
      const result = await pool.query("SELECT * FROM loans ORDER BY created_at DESC");
      return result.rows;
   } catch (error) {
      console.error("Error fetching loan applications:", error.message);
      return { error: error.message };
   }
}

// This handles loan disbursement by the admin. It assigns the monthly installment by diving the total repayment amount by the vendors' selected duration
export async function prepareLoanRepayment(loanId) {
   try {
      const loanQuery = `
        SELECT id, repay_amount, repay_period, status, disbursed_at
        FROM loans 
        WHERE id = $1
      `;

      const loanResult = await pool.query(loanQuery, [loanId]);

      if (loanResult.rows.length === 0) {
         return { success: false, error: "Loan not found" };
      }

      const loan = loanResult.rows[0];

      if (loan.status !== "approved") {
         return { success: false, error: "Loan must be approved before disbursement" };
      }

      if (loan.disbursed_at) {
         return { success: false, error: "Loan has already been disbursed" };
      }

      const repayAmount = loan.repay_amount;
      const monthlyInstallment = repayAmount / loan.repay_period;

      const updateQuery = `
        UPDATE loans SET monthly_installment = $1, status = 'active', disbursed_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *
      `;
      const result = await pool.query(updateQuery, [monthlyInstallment, loanId]);

      return { success: true, data: result.rows[0] };
   } catch (error) {
      console.error("Error preparing loan repayment:", error);
      return { success: false, error: error.message || "Internal server error" };
   }
}
