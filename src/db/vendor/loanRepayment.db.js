import pool from "../../lib/connect.js";

export const loanRepaymentService = {
   /*   async getLoanSummary(loanId) {
      try {
         const queryText = `
        SELECT 
          id,
          amount,
          repay_amount,
          monthly_installment,
          amount_paid,
          status,
          disbursed_at,
          created_at
        FROM loans
        WHERE id = $1
      `;

         const result = await pool.query(queryText, [loanId]);

         if (result.rows.length === 0) {
            return { success: false, error: "Loan not found" };
         }

         const loan = result.rows[0];

         const remainingBalance = Number(loan.repay_amount) - Number(loan.amount_paid);

         return {
            success: true,
            data: {
               ...loan,
               remaining_balance: remainingBalance,
            },
         };
      } catch (error) {
         console.error("Error getting loan summary:", error);
         throw error;
      }
   }, */

   /* async calculatePaymentAmount(loanId) {
      try {
         const loanResult = await this.getLoanSummary(loanId);

         if (!loanResult.success) {
            throw new Error(loanResult.error);
         }

         const loan = loanResult.data;

         if (loan.status !== "active") {
            throw new Error("Loan is not active for payment");
         }

         const remainingBalance = loan.remaining_balance;

         if (remainingBalance <= 0) {
            throw new Error("Loan has been fully paid");
         }

         let paymentAmount;

         if (remainingBalance <= loan.monthly_installment) {
            paymentAmount = remainingBalance;
         } else {
            paymentAmount = loan.monthly_installment;
         }

         return {
            payment_amount: paymentAmount,
            remaining_balance: remainingBalance,
            is_final_payment: remainingBalance <= loan.monthly_installment,
         };
      } catch (error) {
         console.error("Error calculating payment amount:", error);
         throw error;
      }
   }, */

   async recordLoanPayment(loanId, amount, paystackReference) {
      const client = await pool.connect();

      try {
         await client.query("BEGIN");

         // prevent duplicate webhook processing
         const checkReferenceQuery = `SELECT id FROM loan_payments WHERE paystack_reference = $1
      `;

         const existingRef = await client.query(checkReferenceQuery, [paystackReference]);

         if (existingRef.rows.length > 0) {
            throw new Error("Payment reference already exists");
         }

         // insert payment
         const insertPaymentQuery = `
        INSERT INTO loan_payments (loan_id, amount, paystack_reference, paid_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;

         await client.query(insertPaymentQuery, [loanId, amount, paystackReference]);

         // update loan paid amount
         const updateLoanQuery = `
        UPDATE loans SET amount_paid = amount_paid + $1, updated_at = NOW() WHERE id = $2
        RETURNING *
      `;
         const updatedLoanResult = await client.query(updateLoanQuery, [amount, loanId]);

         const updatedLoan = updatedLoanResult.rows[0];

         // check if loan is fully paid
         if (Number(updatedLoan.amount_paid) >= Number(updatedLoan.repay_amount)) {
            await client.query(
               `UPDATE loans SET status = 'completed', monthly_installment = 0.00, updated_at = NOW() WHERE id = $1`,
               [loanId],
            );
         }
         await client.query("COMMIT");
         return {
            success: true,
            /* payment: paymentResult.rows[0],
            loan_status:
               Number(updatedLoan.amount_paid) >= Number(updatedLoan.repay_amount) ? "completed" : updatedLoan.status,
            total_paid: updatedLoan.amount_paid,
            repay_amount: updatedLoan.repay_amount, */
         };
      } catch (error) {
         await client.query("ROLLBACK");
         console.error("Error recording loan payment:", error);
         throw error;
      } finally {
         client.release();
      }
   },

   /*  async getLoanPayments(loanId) {
      try {
         const queryText = `
        SELECT 
          id,
          amount,
          paystack_reference,
          payment_method,
          paid_at,
          created_at
        FROM loan_payments 
        WHERE loan_id = $1
        ORDER BY paid_at DESC
      `;

         const result = await client.query(queryText, [loanId]);
         return result.rows;
      } catch (error) {
         console.error("Error getting loan payments:", error);
         throw error;
      }
   }, */

   /*   async getVendorLoans(vendorId) {
      try {
         const queryText = `
        SELECT 
          id,
          org_name,
          amount,
          repay_amount,
          monthly_installment,
          amount_paid,
          repay_period,
          status,
          disbursed_at,
          created_at,
          updated_at
        FROM loans 
        WHERE vendor_id = $1
        ORDER BY created_at DESC
      `;

         const result = await pool.query(queryText, [vendorId]);

         return result.rows.map((loan) => ({
            ...loan,
            remaining_balance: loan.repay_amount ? loan.repay_amount - loan.amount_paid : 0,
         }));
      } catch (error) {
         console.error("Error getting vendor loans:", error);
         throw error;
      }
   }, */
};
