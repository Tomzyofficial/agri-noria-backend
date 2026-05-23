import {
  createPayment,
  getPaymentByReference,
  updatePaymentStatus,
} from "../../db/payments.db.js";
import {
  initializePaystack,
  verifyPaystackTransaction,
} from "../../lib/services/paystack.service.js";
import { verifyBuyerToken } from "../../sessions/buyer.auth.session.js";

const checkoutCallbackUrl = () => {
  const base =
    process.env.APP_BASEURL ||
    process.env.FRONTEND_APP_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/checkout/summary`;
};

export async function initializeBuyerPayment(req, res) {
  try {
    const payload = await verifyBuyerToken(req);
    if (!payload?.buyer_id) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { order_id, amount, email, firstname, lastname, seller_id } =
      req.body;

    if (!order_id || !amount || !email) {
      return res.status(400).json({
        success: false,
        error: "order_id, amount, and email are required",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be greater than zero",
      });
    }

    const payment = await createPayment({
      order_id,
      payer_id: payload.buyer_id,
      amount,
      currency: "NGN",
      payment_provider: "paystack",
      status: "pending",
      escrow_status: "held",
      payment_method: "card",
      metadata: {
        seller_id,
        firstname,
        lastname,
      },
    });

    const initResponse = await initializePaystack("/transaction/initialize", {
      body: {
        email,
        amount: Math.round(Number(amount) * 100),
        metadata: {
          order_id,
          payment_id: payment.id,
          buyer_id: payload.buyer_id,
          seller_id,
          category: "buyer_order",
        },
        callback_url: checkoutCallbackUrl(),
      },
    });

    const reference = initResponse.data.reference;

    const existingMetadata =
      typeof payment.metadata === "object" && payment.metadata !== null
        ? payment.metadata
        : {};

    await updatePaymentStatus(payment.id, "processing", {
      provider_reference: reference,
      metadata: {
        ...existingMetadata,
        paystack_access_code: initResponse.data.access_code,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        authorization_url: initResponse.data.authorization_url,
        access_code: initResponse.data.access_code,
        reference,
        payment_id: payment.id,
      },
    });
  } catch (error) {
    console.error("Error initializing buyer payment:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to initialize payment",
    });
  }
}

export async function verifyBuyerPayment(req, res) {
  try {
    const payload = await verifyBuyerToken(req);
    if (!payload?.buyer_id) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const ref = req.query.ref || req.query.reference;
    if (!ref) {
      return res.status(400).json({
        success: false,
        error: "Payment reference is required",
      });
    }

    const verifyRes = await verifyPaystackTransaction(ref);
    if (verifyRes.data?.status !== "success") {
      return res.status(400).json({
        success: false,
        error: "Payment verification not successful",
      });
    }

    const payment = await getPaymentByReference(ref);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: "Payment record not found",
      });
    }

    if (payment.payer_id !== payload.buyer_id) {
      return res.status(403).json({
        success: false,
        error: "Payment does not belong to this buyer",
      });
    }

    if (payment.status === "completed") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        data: payment,
      });
    }

    const expectedAmountKobo = Math.round(Number(payment.amount) * 100);
    if (verifyRes.data.amount !== expectedAmountKobo) {
      return res.status(400).json({
        success: false,
        error: "Payment amount mismatch",
      });
    }

    const existingMetadata =
      typeof payment.metadata === "object" && payment.metadata !== null
        ? payment.metadata
        : {};

    const updatedPayment = await updatePaymentStatus(payment.id, "completed", {
      provider_reference: ref,
      provider_payment_code: String(verifyRes.data.id),
      metadata: {
        ...existingMetadata,
        paystack: {
          status: verifyRes.data.status,
          paid_at: verifyRes.data.paid_at,
          channel: verifyRes.data.channel,
          currency: verifyRes.data.currency,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified and recorded successfully",
      data: updatedPayment,
    });
  } catch (error) {
    console.error("Error verifying buyer payment:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to verify payment",
    });
  }
}
