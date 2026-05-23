import {
  createNewApplication,
  getAllApplications,
} from "../../db/vendor/loan.db.js";
import { saveFileToCloudinary } from "../../lib/cloudinary.img.js";
// import { initializePaystack, verifyPaystackTransaction } from "../../services/paystack/paystack.service.js";
import {
  initializePaystack,
  verifyPaystackTransaction,
} from "../../lib/services/paystack.service.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const loanControllerServices = {};

loanControllerServices.submitLoanApplication = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const vendor_id = payload.id;
    const {
      org_name,
      amount,
      repay_amount,
      repay_period,
      monthly_revenue,
      years_in_operation,
      farm_size,
      primary_crop,
      inv_type,
      total_capacity,
      current_utilization,
      storage_type,
      farmers_served,
    } = req.body;

    let supporting_doc = null;
    let bank_statement = null;

    const processImage = async (file, fieldName) => {
      if (!file.mimetype?.startsWith("image/")) {
        return { success: false, error: `${fieldName} must be an image` };
      }
      if (file.size > 5 * 1024 * 1024) {
        return { success: false, error: `${fieldName} exceeds 5MB` };
      }
      return await saveFileToCloudinary(file, "vendor_loan_documents", "image");
    };

    if (req.files) {
      if (req.files["supporting_doc"]?.[0]) {
        supporting_doc = await processImage(
          req.files["supporting_doc"][0],
          "Supporting document",
        );
      }
      if (req.files["bank_statement"]?.[0]) {
        bank_statement = await processImage(
          req.files["bank_statement"][0],
          "Bank statement",
        );
      }
    } else {
      return res
        .status(400)
        .json({ success: false, error: "Files are required" });
    }

    const result = await createNewApplication({
      data: {
        vendor_id,
        org_name,
        years_in_operation,
        amount,
        repay_amount,
        repay_period,
        monthly_revenue,
        farm_size,
        primary_crop,
        inv_type,
        total_capacity,
        current_utilization,
        storage_type,
        farmers_served,
        supporting_doc,
        bank_statement,
      },
    });
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res
      .status(201)
      .json({
        success: true,
        message: "Loan application submitted successfully",
        data: result.data,
      });
  } catch {
    res
      .status(500)
      .json({ success: false, error: "Failed to submit loan application" });
  }
};

loanControllerServices.getAllLoanApplications = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const loans = await getAllApplications(payload.id);
    res.status(200).json({ success: true, data: loans });
  } catch (error) {
    console.error("Error fetching loan applications:", error.message);
    res
      .status(500)
      .json({
        message: "Failed to fetch loan applications",
        error: error.message,
      });
  }
};

loanControllerServices.initialize = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const { email, amount } = req.body;
  const { loanId } = req.params;

  if (!amount || amount <= 0) {
    return res
      .status(400)
      .json({
        success: false,
        error: "Invalid amount. Amount must be a positive number.",
      });
  }

  if (!email || typeof email !== "string") {
    return res
      .status(400)
      .json({ success: false, error: "Invalid email address." });
  }

  if (!loanId) {
    return res.status(404).json({ success: false, error: "Loan not found" });
  }
  // For paystack callback
  const accountTypeRoutes = {
    farmer: "/dashboard/store/",
    seller: "/dashboard/store/",
    storage_facility: "/dashboard/sub-store/",
    logistics: "/dashboard/logistics/",
    admin: "/dashboard/admin/",
  };
  const targetRoute = accountTypeRoutes[payload.account_type?.toLowerCase()];

  try {
    const metadata = { category: "loan_repayment", loan_id: loanId };

    const initResponse = await initializePaystack("/transaction/initialize", {
      body: {
        email: email,
        amount: amount * 100,
        metadata: metadata,
        callback_url: `${process.env.APP_BASEURL}${targetRoute}loan`,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        authorization_url: initResponse.data.authorization_url,
      },
    });
  } catch (error) {
    console.error("Payment initialization error:", error.message);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to initialize payment",
      });
  }
};

loanControllerServices.verifyPayment = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload?.id) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const ref = req.query.ref;
    const verifyRes = await verifyPaystackTransaction(ref);
    if (verifyRes.data?.status !== "success") {
      console.log("payment successful but not verified");
      return res
        .status(400)
        .json({ success: false, error: "Payment verification not successful" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error verifing paystack payment", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export default loanControllerServices;
