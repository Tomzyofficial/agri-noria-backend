import pool from "../../lib/connect.js";

// ============ STAGE 12: BUYER/OFFTAKER MATCHING ============

export const marketplaceDb = {
   // Listings
   createListing: async (aggregatorId, listingData) => {
      const { commodity, quantity, unit, estimatedQuality, harvestDate, location } = listingData;
      const result = await pool.query(
         `INSERT INTO buyer_marketplace_listings 
          (aggregator_id, commodity, quantity, unit, estimated_quality, harvest_date, location) 
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
         [aggregatorId, commodity, quantity, unit, estimatedQuality, harvestDate, location],
      );
      return result.rows[0];
   },

   getListings: async (filters = {}) => {
      let query = "SELECT * FROM buyer_marketplace_listings WHERE 1=1";
      const values = [];
      let counter = 1;

      if (filters.aggregator_id) {
         query += ` AND aggregator_id = $${counter}`;
         values.push(filters.aggregator_id);
         counter++;
      }
      if (filters.status) {
         query += ` AND status = $${counter}`;
         values.push(filters.status);
         counter++;
      }
      if (filters.commodity) {
         query += ` AND commodity = $${counter}`;
         values.push(filters.commodity);
         counter++;
      }

      query += " ORDER BY created_at DESC";
      const result = await pool.query(query, values);
      return result.rows;
   },

   // Buyer Offers
   createOffer: async (listingId, buyerId, price, quantity, terms) => {
      const result = await pool.query(
         `INSERT INTO buyer_offers (listing_id, buyer_id, offered_price, quantity_offered, terms) 
          VALUES ($1, $2, $3, $4, $5) RETURNING *`,
         [listingId, buyerId, price, quantity, terms],
      );
      return result.rows[0];
   },

   getOffers: async (listingId) => {
      const result = await pool.query("SELECT * FROM buyer_offers WHERE listing_id = $1 ORDER BY created_at DESC", [
         listingId,
      ]);
      return result.rows;
   },

   // Contracts
   createContract: async (contractData) => {
      const { listing_id, buyer_id, aggregator_id, terms, price, quantity, delivery_date } = contractData;
      const result = await pool.query(
         `INSERT INTO buyer_contracts 
          (listing_id, buyer_id, aggregator_id, contract_terms, contract_price, quantity_contracted, delivery_date, signed_at) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
         [listing_id, buyer_id, aggregator_id, terms, price, quantity, delivery_date],
      );
      return result.rows[0];
   },

   getContractsByAggregator: async (aggregatorId) => {
      const result = await pool.query(
         "SELECT * FROM buyer_contracts WHERE aggregator_id = $1 ORDER BY created_at DESC",
         [aggregatorId],
      );
      return result.rows;
   },
};

// ============ STAGE 13: SALES & SETTLEMENT ============

export const settlementDb = {
   createSale: async (contractId, aggregatorId, buyerId, amount, quantity) => {
      const result = await pool.query(
         `INSERT INTO sales (contract_id, aggregator_id, buyer_id, sale_amount, quantity_sold) 
          VALUES ($1, $2, $3, $4, $5) RETURNING *`,
         [contractId, aggregatorId, buyerId, amount, quantity],
      );
      return result.rows[0];
   },

   createSettlement: async (saleId, settlementData) => {
      const { total_sales_value, farmer_payout, financing_recovery, logistics_fees, insurance_fees, commission } =
         settlementData;
      const result = await pool.query(
         `INSERT INTO sales_settlements 
          (sale_id, total_sales_value, farmer_payout, financing_recovery, logistics_fees, insurance_fees, aggregator_commission) 
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
         [saleId, total_sales_value, farmer_payout, financing_recovery, logistics_fees, insurance_fees, commission],
      );
      return result.rows[0];
   },

   recordPaymentBreakdown: async (settlement_id, payouts) => {
      // payouts = [{type, recipient_id, amount, wallet_id}, ...]
      for (const payout of payouts) {
         await pool.query(
            `INSERT INTO payment_breakdowns (settlement_id, payout_type, recipient_id, amount, wallet_credited_to) 
             VALUES ($1, $2, $3, $4, $5)`,
            [settlement_id, payout.type, payout.recipient_id, payout.amount, payout.wallet_id],
         );
      }
   },

   getSalesByAggregator: async (aggregatorId) => {
      const result = await pool.query(
         "SELECT s.*, ss.* FROM sales s LEFT JOIN sales_settlements ss ON s.id = ss.sale_id WHERE s.aggregator_id = $1",
         [aggregatorId],
      );
      return result.rows;
   },
};

// ============ STAGE 14: REPAYMENT & RECONCILIATION ============

export const repaymentDb = {
   createFinancingRepayment: async (agreementId, originalAmount, interestRate) => {
      const totalDue = originalAmount * (1 + interestRate / 100);
      const result = await pool.query(
         `INSERT INTO financing_repayments (agreement_id, original_amount, interest_rate, total_due) 
          VALUES ($1, $2, $3, $4) RETURNING *`,
         [agreementId, originalAmount, interestRate, totalDue],
      );
      return result.rows[0];
   },

   recordRepaymentTransaction: async (repaymentId, amountPaid, paymentMethod, referenceId) => {
      const result = await pool.query(
         `INSERT INTO repayment_transactions (repayment_id, amount_paid, payment_method, payment_date, reference_id) 
          VALUES ($1, $2, $3, NOW(), $4) RETURNING *`,
         [repaymentId, amountPaid, paymentMethod, referenceId],
      );

      // Update repayment status
      await pool.query(`UPDATE financing_repayments SET amount_recovered = amount_recovered + $1 WHERE id = $2`, [
         amountPaid,
         repaymentId,
      ]);

      return result.rows[0];
   },

   updateCreditScore: async (vendorId, scoreData) => {
      const { repayment_score, yield_score, compliance_score, payment_reliability_score } = scoreData;
      const current_score = (repayment_score + yield_score + compliance_score + payment_reliability_score) / 4;

      const result = await pool.query(
         `UPDATE credit_scores 
          SET current_score = $1, repayment_history_score = $2, yield_performance_score = $3, 
              compliance_score = $4, payment_reliability_score = $5, last_updated = NOW() 
          WHERE vendor_id = $6 RETURNING *`,
         [current_score, repayment_score, yield_score, compliance_score, payment_reliability_score, vendorId],
      );

      if (result.rows.length === 0) {
         const createResult = await pool.query(
            `INSERT INTO credit_scores 
             (vendor_id, current_score, repayment_history_score, yield_performance_score, compliance_score, payment_reliability_score, last_updated) 
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
            [vendorId, current_score, repayment_score, yield_score, compliance_score, payment_reliability_score],
         );
         return createResult.rows[0];
      }

      return result.rows[0];
   },

   getCreditScore: async (vendorId) => {
      const result = await pool.query("SELECT * FROM credit_scores WHERE vendor_id = $1", [vendorId]);
      return result.rows[0];
   },
};

// ============ STAGE 15: REPORTING & INTELLIGENCE ============

export const intelligenceDb = {
   recordSystemMetrics: async (metricsData) => {
      const {
         date,
         totalTransactions,
         totalValue,
         totalFarmers,
         totalProduction,
         avgYield,
         repaymentRate,
         defaultRate,
         exportReady,
         clusterPerf,
      } = metricsData;
      const result = await pool.query(
         `INSERT INTO system_metrics 
          (metric_date, total_transactions, total_value, total_farmers, total_production, average_yield, repayment_rate, default_rate, export_readiness_count, cluster_performance_average) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
         [
            date,
            totalTransactions,
            totalValue,
            totalFarmers,
            totalProduction,
            avgYield,
            repaymentRate,
            defaultRate,
            exportReady,
            clusterPerf,
         ],
      );
      return result.rows[0];
   },

   recordYieldForecast: async (programId, crop, region, forecastDate, expectedYield, confidence) => {
      const result = await pool.query(
         `INSERT INTO yield_forecasts (program_id, crop, region, forecast_date, expected_yield, confidence_level) 
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
         [programId, crop, region, forecastDate, expectedYield, confidence],
      );
      return result.rows[0];
   },

   recordClimateRisk: async (region, riskType, riskLevel, crops, period, recommendations) => {
      const result = await pool.query(
         `INSERT INTO climate_risks (region, risk_type, risk_level, affected_crops, forecast_period, mitigation_recommendations) 
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
         [region, riskType, riskLevel, crops, period, recommendations],
      );
      return result.rows[0];
   },

   generateInstitutionalReport: async (reportType, periodStart, periodEnd, reportData, generatedBy) => {
      // Calculate totals from reportData
      const totalFarmers = reportData.farmers || 0;
      const totalProduction = reportData.production || 0;
      const totalFinancing = reportData.financing || 0;
      const repaymentPerf = reportData.repaymentRate || 0;

      const result = await pool.query(
         `INSERT INTO institutional_reports (report_type, period_start, period_end, total_farmers, total_production, total_financing, repayment_performance, report_data, generated_by) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
         [
            reportType,
            periodStart,
            periodEnd,
            totalFarmers,
            totalProduction,
            totalFinancing,
            repaymentPerf,
            JSON.stringify(reportData),
            generatedBy,
         ],
      );
      return result.rows[0];
   },

   recordClusterIntelligence: async (clusterId, metricsData) => {
      const {
         metric_date,
         farmer_count,
         production_volume,
         avg_yield,
         input_adoption,
         market_price,
         yield_variance,
         quality_score,
         logistics_efficiency,
      } = metricsData;
      const result = await pool.query(
         `INSERT INTO cluster_intelligence (cluster_id, metric_date, farmer_count, production_volume, average_yield, input_adoption_rate, market_price_index, yield_variance, quality_score, logistics_efficiency) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
         [
            clusterId,
            metric_date,
            farmer_count,
            production_volume,
            avg_yield,
            input_adoption,
            market_price,
            yield_variance,
            quality_score,
            logistics_efficiency,
         ],
      );
      return result.rows[0];
   },

   getSystemMetrics: async (dateFrom, dateTo) => {
      const result = await pool.query(
         "SELECT * FROM system_metrics WHERE metric_date BETWEEN $1 AND $2 ORDER BY metric_date DESC",
         [dateFrom, dateTo],
      );
      return result.rows;
   },

   getClimateRisks: async (region = null) => {
      if (region) {
         const result = await pool.query(
            "SELECT * FROM climate_risks WHERE region = $1 ORDER BY created_at DESC LIMIT 10",
            [region],
         );
         return result.rows;
      }
      const result = await pool.query("SELECT * FROM climate_risks ORDER BY created_at DESC LIMIT 20");
      return result.rows;
   },
};

// Exporting the database modules
// (Already exported via 'export const' at definition)

