import { z } from "zod";
import pool from "../lib/connect.js";
import {
  createPayment,
  //   getPaymentById,
  //   getPaymentByOrderId,
  getPaymentByReference,
  updatePaymentStatus,
  //   updateEscrowStatus,
  //   getPaymentsByPayerId,
  //   getPaymentsBySellerId,
  //   getHeldEscrowPayments,
  //   refundPayment,
  //   getSellerPaymentStats,
  //   getPayerPaymentStats,
} from "../db/payments.db.js";
import {
  initializePaystack,
  verifyPaystackTransaction,
} from "../lib/services/paystack.service.js";
import { verifyBuyerToken } from "../sessions/buyer.auth.session.js";
import { updateOrderStatus } from "../db/buyer/orders.db.js";
import { deleteCartCookie } from "../sessions/cart.cookie.session.js";
import emailService from "../services/email/email.service.js";
import { getOrderDataForEmails } from "../db/logistics/logisiticsOperation.db.js";
// Zod schema for payment creation
// const paymentSchema = z.object({
//   order_id: z.string().uuid('Invalid order ID'),
//   payer_id: z.string().uuid('Invalid payer ID'),
//   amount: z.number().positive('Amount must be positive'),
//   currency: z.string().default('NGN'),
//   payment_provider: z.string().optional(),
//   provider_reference: z.string().optional(),
//   provider_payment_code: z.string().optional(),
//   status: z.enum(['pending', 'processing', 'completed', 'failed', 'refunded']).default('pending'),
//   escrow_status: z.enum(['held', 'released', 'refunded', 'disputed']).default('held'),
//   payment_method: z.string().optional(),
//   metadata: z.record(z.any()).optional().default({})
// });

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
    if (!payload) {
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
      error: "Failed to initialize payment. Try again later.",
    });
  }
}

export async function verifyBuyerPayment(req, res) {
  try {
    const payload = await verifyBuyerToken(req);
    if (!payload) {
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

    if (payment.order_id) {
      await updateOrderStatus(payment.order_id, "paid");

      // Send emails to buyer, seller, and logistics partner
      try {
        const orderDataResult = await getOrderDataForEmails(payment.order_id);
        if (orderDataResult.success && orderDataResult.data) {
          const emailData = orderDataResult.data;
          await emailService.sendOrderNotificationEmails(emailData);
        }
      } catch (emailError) {
        console.error(
          "Warning: Failed to send order notification emails:",
          emailError.message,
        );
        // Don't block payment confirmation if email sending fails
      }
    }

    // Clear cart after payment is confirmed
    try {
      // Delete all cart items for this buyer
      await pool.query(
        `DELETE FROM cart_items WHERE cart_id IN 
         (SELECT cart_id FROM carts WHERE buyer_id = $1)`,
        [payload.buyer_id],
      );

      // Delete the cart itself for this buyer
      await pool.query(`DELETE FROM carts WHERE buyer_id = $1`, [
        payload.buyer_id,
      ]);

      await deleteCartCookie(res);
    } catch (cartError) {
      console.error(
        `Warning: Failed to clear cart for buyer ${payload.buyer_id}:`,
        cartError,
      );
      // Don't block payment confirmation if cart deletion fails
    }

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

// Get payment by ID
// export async function getPaymentByIdController(req, res) {
//   try {
//     const { id } = req.params;

//     if (!id) {
//       return res.status(400).json({
//         success: false,
//         message: "Payment ID is required",
//       });
//     }

//     const payment = await getPaymentById(id);

//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: "Payment not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: payment,
//     });
//   } catch (error) {
//     console.error("Error getting payment:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get payment",
//       error: error.message,
//     });
//   }
// }

// Get payment by order ID
// export async function getPaymentByOrderIdController(req, res) {
//   try {
//     const { order_id } = req.params;

//     if (!order_id) {
//       return res.status(400).json({
//         success: false,
//         message: "Order ID is required",
//       });
//     }

//     const payment = await getPaymentByOrderId(order_id);

//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: "Payment not found for this order",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: payment,
//     });
//   } catch (error) {
//     console.error("Error getting payment by order:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get payment",
//       error: error.message,
//     });
//   }
// }

// Get payment by provider reference (for webhooks)
// export async function getPaymentByReferenceController(req, res) {
//   try {
//     const { reference } = req.params;

//     if (!reference) {
//       return res.status(400).json({
//         success: false,
//         message: "Reference is required",
//       });
//     }

//     const payment = await getPaymentByReference(reference);

//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: "Payment not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: payment,
//     });
//   } catch (error) {
//     console.error("Error getting payment by reference:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get payment",
//       error: error.message,
//     });
//   }
// }

// Update payment status (for webhooks)
// export async function updatePaymentStatusController(req, res) {
//   try {
//     const { id } = req.params;
//     const { status, provider_reference, provider_payment_code, metadata } =
//       req.body;

//     if (!id) {
//       return res.status(400).json({
//         success: false,
//         message: "Payment ID is required",
//       });
//     }

//     if (!status) {
//       return res.status(400).json({
//         success: false,
//         message: "Status is required",
//       });
//     }

//     const validStatuses = [
//       "pending",
//       "processing",
//       "completed",
//       "failed",
//       "refunded",
//     ];
//     if (!validStatuses.includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid status value",
//       });
//     }

//     const payment = await updatePaymentStatus(id, status, {
//       provider_reference,
//       provider_payment_code,
//       metadata,
//     });

//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: "Payment not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Payment status updated successfully",
//       data: payment,
//     });
//   } catch (error) {
//     console.error("Error updating payment status:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update payment status",
//       error: error.message,
//     });
//   }
// }

// Update escrow status
// export async function updateEscrowStatusController(req, res) {
//   try {
//     const { id } = req.params;
//     const { escrow_status, release_reason } = req.body;

//     if (!id) {
//       return res.status(400).json({
//         success: false,
//         message: "Payment ID is required",
//       });
//     }

//     if (!escrow_status) {
//       return res.status(400).json({
//         success: false,
//         message: "Escrow status is required",
//       });
//     }

//     const validEscrowStatuses = ["held", "released", "refunded", "disputed"];
//     if (!validEscrowStatuses.includes(escrow_status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid escrow status value",
//       });
//     }

//     const payment = await updateEscrowStatus(id, escrow_status, release_reason);

//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: "Payment not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Escrow status updated successfully",
//       data: payment,
//     });
//   } catch (error) {
//     console.error("Error updating escrow status:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update escrow status",
//       error: error.message,
//     });
//   }
// }

// Get payments by payer ID
// export async function getPayerPaymentsController(req, res) {
//   try {
//     const { payer_id } = req.params;
//     const limit = parseInt(req.query.limit) || 50;
//     const offset = parseInt(req.query.offset) || 0;

//     if (!payer_id) {
//       return res.status(400).json({
//         success: false,
//         message: "Payer ID is required",
//       });
//     }

//     const payments = await getPaymentsByPayerId(payer_id, limit, offset);

//     res.status(200).json({
//       success: true,
//       data: payments,
//       pagination: {
//         limit,
//         offset,
//         count: payments.length,
//       },
//     });
//   } catch (error) {
//     console.error("Error getting payer payments:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get payer payments",
//       error: error.message,
//     });
//   }
// }

// Get payments by seller ID
// export async function getSellerPaymentsController(req, res) {
//   try {
//     const { seller_id } = req.params;
//     const limit = parseInt(req.query.limit) || 50;
//     const offset = parseInt(req.query.offset) || 0;

//     if (!seller_id) {
//       return res.status(400).json({
//         success: false,
//         message: "Seller ID is required",
//       });
//     }

//     const payments = await getPaymentsBySellerId(seller_id, limit, offset);

//     res.status(200).json({
//       success: true,
//       data: payments,
//       pagination: {
//         limit,
//         offset,
//         count: payments.length,
//       },
//     });
//   } catch (error) {
//     console.error("Error getting seller payments:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get seller payments",
//       error: error.message,
//     });
//   }
// }

// Refund payment
// export async function refundPaymentController(req, res) {
//   try {
//     const { id } = req.params;
//     const { reason } = req.body;

//     if (!id) {
//       return res.status(400).json({
//         success: false,
//         message: "Payment ID is required",
//       });
//     }

//     const payment = await refundPayment(id, reason);

//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: "Payment not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Payment refunded successfully",
//       data: payment,
//     });
//   } catch (error) {
//     console.error("Error refunding payment:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to refund payment",
//       error: error.message,
//     });
//   }
// }

// Get seller payment statistics
// export async function getSellerPaymentStatsController(req, res) {
//   try {
//     const { seller_id } = req.params;

//     if (!seller_id) {
//       return res.status(400).json({
//         success: false,
//         message: "Seller ID is required",
//       });
//     }

//     const stats = await getSellerPaymentStats(seller_id);

//     res.status(200).json({
//       success: true,
//       data: stats,
//     });
//   } catch (error) {
//     console.error("Error getting seller payment stats:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get seller payment statistics",
//       error: error.message,
//     });
//   }
// }

// Get payer payment statistics
// export async function getPayerPaymentStatsController(req, res) {
//   try {
//     const { payer_id } = req.params;

//     if (!payer_id) {
//       return res.status(400).json({
//         success: false,
//         message: "Payer ID is required",
//       });
//     }

//     const stats = await getPayerPaymentStats(payer_id);

//     res.status(200).json({
//       success: true,
//       data: stats,
//     });
//   } catch (error) {
//     console.error("Error getting payer payment stats:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get payer payment statistics",
//       error: error.message,
//     });
//   }
// }

// Get held escrow payments (for auto-release)
// export async function getHeldEscrowPaymentsController(req, res) {
//   try {
//     const payments = await getHeldEscrowPayments();

//     res.status(200).json({
//       success: true,
//       data: payments,
//       count: payments.length,
//     });
//   } catch (error) {
//     console.error("Error getting held escrow payments:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get held escrow payments",
//       error: error.message,
//     });
//   }
// }
