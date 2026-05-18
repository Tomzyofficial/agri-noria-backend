import {
   handleSubscriptionCreated,
   handleChargeSuccess,
   handleInvoiceCreated,
   handleInvoicePaymentFailed,
   handleSubscriptionDisabled,
   handleSubscriptionNotRenew,
   handleInvoiceUpdate,
   handleLoanRepayment,
   handleAggregatorEscrow,
} from "./paystack.webhook.helpers.js";
import crypto from "crypto";

const LOG = (label, data) => {
   const timestamp = new Date().toISOString();
   const logEntry = {
      timestamp,
      label: `[BILLING:${label}]`,
      data: typeof data === "object" ? JSON.stringify(data, null, 2) : data,
   };
   console.log(logEntry.label, logEntry.data);
};

export const webhook = async (req, res) => {
   try {
      console.log("!!! WEBHOOK RECEIVED !!!");
      console.log("Event Type:", req.body?.event);
      const signature = req.headers["x-paystack-signature"];
      if (!signature) {
         LOG("WEBHOOK_NO_SIGNATURE", { headers: req.headers });
         return res.status(401).send("Missing signature");
      }

      const hash = crypto
         .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
         .update(JSON.stringify(req.body))
         .digest("hex");

      if (hash !== signature) {
         return res.sendStatus(400);
      }

      // Validate event structure
      const event = req.body;

      if (!event || !event.event || !event.data) {
         LOG("WEBHOOK_INVALID_EVENT_STRUCTURE", { event });
         return res.status(400).send("Invalid event structure");
      }

      const metadata = event.data?.metadata;
      const category = metadata?.category;

      LOG("WEBHOOK_EVENT_RECEIVED", {
         event: event.event,
         hasData: !!event.data,
         hasMetadata: !!metadata,
         category: category,
         timestamp: new Date().toISOString(),
      });

      try {
         switch (event.event) {
            case "subscription.create":
               await handleSubscriptionCreated(event.data);
               break;
            case "charge.success":
               if (category === "loan_repayment") {
                  await handleLoanRepayment(event.data);
               } else if (category === "aggregator_escrow") {
                  await handleAggregatorEscrow(event.data);
               } else {
                  await handleChargeSuccess(event.data);
               }
               break;
            case "subscription.disable":
               await handleSubscriptionDisabled(event.data);
               break;
            case "subscription.not_renew":
               await handleSubscriptionNotRenew(event.data);
               break;
            case "invoice.create":
               await handleInvoiceCreated(event.data);
               break;
            case "invoice.payment_failed":
               await handleInvoicePaymentFailed(event.data);
               break;
            case "invoice.update":
               await handleInvoiceUpdate(event.data);
               break;
            default:
               LOG("WEBHOOK_UNHANDLED_EVENT", { event: event.event });
               break;
         }
      } catch (handlerError) {
         LOG("WEBHOOK_HANDLER_ERROR", {
            event: event.event,
            error: handlerError.message,
            stack: handlerError.stack,
         });
      }
      res.sendStatus(200);
   } catch (error) {
      LOG("WEBHOOK_CRITICAL_ERROR", {
         message: error.message,
         stack: error.stack,
         headers: req.headers,
      });
      res.status(400).send(`Webhook error: Error occurred within the webhook`);
   }
};
