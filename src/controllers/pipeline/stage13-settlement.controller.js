import { settlementDb } from "../../db/marketplace/marketplace.db.js";

// ============ STAGE 13: SALES & SETTLEMENT ============

export const createSalesContract = async (req, res) => {
   try {
      const { id: vendorId, account_type: role } = req.user;

      if (role !== "aggregator") {
         return res.status(403).json({ error: "Only aggregators can create contracts" });
      }

      const { listing_id, buyer_id, contract_terms, contract_price, quantity_contracted, delivery_date } = req.body;

      const contract = await settlementDb.createContract({
         listing_id,
         buyer_id,
         aggregator_id: vendorId,
         terms: contract_terms,
         price: contract_price,
         quantity: quantity_contracted,
         delivery_date,
      });

      res.status(201).json({
         success: true,
         message: "Sales contract created",
         contract,
      });
   } catch (err) {
      console.error("Create contract error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const recordSale = async (req, res) => {
   try {
      const { id: vendorId } = req.user;
      const { contract_id, buyer_id, sale_amount, quantity_sold } = req.body;

      const sale = await settlementDb.createSale(contract_id, vendorId, buyer_id, sale_amount, quantity_sold);

      res.status(201).json({
         success: true,
         message: "Sale recorded successfully",
         sale,
      });
   } catch (err) {
      console.error("Record sale error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const settleSale = async (req, res) => {
   try {
      const { id: vendorId, account_type: role } = req.user;

      if (role !== "finance" && role !== "super admin") {
         return res.status(403).json({ error: "Only Finance/Super Admin can settle sales" });
      }

      const {
         sale_id,
         total_sales_value,
         farmer_payout,
         financing_recovery,
         logistics_fees,
         insurance_fees,
         commission,
      } = req.body;

      // Create settlement record
      const settlement = await settlementDb.createSettlement(sale_id, {
         total_sales_value,
         farmer_payout,
         financing_recovery,
         logistics_fees,
         insurance_fees,
         commission,
      });

      res.status(201).json({
         success: true,
         message: "Sale settled successfully",
         settlement,
      });
   } catch (err) {
      console.error("Settle sale error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const getSalesForAggregator = async (req, res) => {
   try {
      const { id: vendorId } = req.user;
      const sales = await settlementDb.getSalesByAggregator(vendorId);

      res.status(200).json({
         success: true,
         count: sales.length,
         sales,
      });
   } catch (err) {
      console.error("Get sales error:", err);
      res.status(500).json({ error: err.message });
   }
};

export default {
   createSalesContract,
   recordSale,
   settleSale,
   getSalesForAggregator,
};
