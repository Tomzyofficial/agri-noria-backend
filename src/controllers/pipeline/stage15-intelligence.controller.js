import { intelligenceDb } from "../../db/marketplace/marketplace.db.js";

// ============ STAGE 15: REPORTING & INTELLIGENCE ============

export const recordSystemMetrics = async (req, res) => {
   try {
      const { id: userId, account_type: role } = req.user;

      if (role !== "super admin") {
         return res.status(403).json({ error: "Only Super Admin can record metrics" });
      }

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
      } = req.body;

      const metrics = await intelligenceDb.recordSystemMetrics({
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
      });

      res.status(201).json({
         success: true,
         message: "System metrics recorded",
         metrics,
      });
   } catch (err) {
      console.error("Record metrics error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const recordYieldForecast = async (req, res) => {
   try {
      const { id: userId, account_type: role } = req.user;

      if (role !== "super admin") {
         return res.status(403).json({ error: "Only Super Admin can record forecasts" });
      }

      const { program_id, crop, region, forecast_date, expected_yield, confidence } = req.body;

      const forecast = await intelligenceDb.recordYieldForecast(
         program_id,
         crop,
         region,
         forecast_date,
         expected_yield,
         confidence,
      );

      res.status(201).json({
         success: true,
         message: "Yield forecast recorded",
         forecast,
      });
   } catch (err) {
      console.error("Record forecast error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const recordClimateRisk = async (req, res) => {
   try {
      const { id: userId, account_type: role } = req.user;

      if (role !== "super admin") {
         return res.status(403).json({ error: "Only Super Admin can record climate risks" });
      }

      const { region, risk_type, risk_level, affected_crops, forecast_period, mitigation_recommendations } = req.body;

      const risk = await intelligenceDb.recordClimateRisk(
         region,
         risk_type,
         risk_level,
         affected_crops,
         forecast_period,
         mitigation_recommendations,
      );

      res.status(201).json({
         success: true,
         message: "Climate risk recorded",
         risk,
      });
   } catch (err) {
      console.error("Record climate risk error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const generateInstitutionalReport = async (req, res) => {
   try {
      const { id: userId, account_type: role } = req.user;

      if (role !== "super admin") {
         return res.status(403).json({ error: "Only Super Admin can generate reports" });
      }

      const { report_type, period_start, period_end, report_data } = req.body;

      const report = await intelligenceDb.generateInstitutionalReport(
         report_type,
         period_start,
         period_end,
         report_data,
         userId,
      );

      res.status(201).json({
         success: true,
         message: "Institutional report generated",
         report,
      });
   } catch (err) {
      console.error("Generate report error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const getSystemMetrics = async (req, res) => {
   try {
      const { date_from, date_to } = req.query;

      if (!date_from || !date_to) {
         return res.status(400).json({ error: "date_from and date_to are required" });
      }

      const metrics = await intelligenceDb.getSystemMetrics(date_from, date_to);

      res.status(200).json({
         success: true,
         count: metrics.length,
         metrics,
      });
   } catch (err) {
      console.error("Get metrics error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const getClimateRisks = async (req, res) => {
   try {
      const { region } = req.query;

      const risks = await intelligenceDb.getClimateRisks(region);

      res.status(200).json({
         success: true,
         count: risks.length,
         risks,
      });
   } catch (err) {
      console.error("Get climate risks error:", err);
      res.status(500).json({ error: err.message });
   }
};

export default {
   recordSystemMetrics,
   recordYieldForecast,
   recordClimateRisk,
   generateInstitutionalReport,
   getSystemMetrics,
   getClimateRisks,
};
