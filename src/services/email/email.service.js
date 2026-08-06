import nodemailer from "nodemailer";
import crypto from "crypto";
import { generateVerificationEmailTemplate } from "./generateVerificationEmailTemplate.js";
import { generateWelcomeEmailTemplate } from "./generateWelcomeEmailTemplate.js";
import { generateBuyerOrderConfirmationTemplate } from "./generateBuyerOrderConfirmationTemplate.js";
import { generateVendorNewOrderTemplate } from "./generateVendorNewOrderTemplate.js";
import { generateLogisticsAssignmentTemplate } from "./generateLogisticsAssignmentTemplate.js";
import { generateShipmentStartTemplate } from "./generateShipmentStartTemplate.js";

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      pool: true,
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === "true", // true for 465, false for 587
      family: 4, // IPv4
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify transporter configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error("Email service configuration error:", error);
      } else {
        console.log("Email service is ready to send messages");
      }
    });
  }

  // Generate 6-digit verification code
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Hash verification code for secure storage
  hashVerificationCode(code) {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  // Verify hashed code
  verifyHashedCode(plainCode, hashedCode) {
    const hashedPlain = this.hashVerificationCode(plainCode);
    return hashedPlain === hashedCode;
  }

  // Send verification email used during vendor registration
  async sendVerificationEmail(email, verificationCode) {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || "Agri-Noria"}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify Your Email Address - Agri-Connect",
        html: generateVerificationEmailTemplate(verificationCode),
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log("Verification email sent successfully:", result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(
        "Error sending verification email from email service file:",
        error.message,
      );
      return { success: false, error: error.message };
    }
  }

  // Send welcome email after successful verification and registration
  async sendWelcomeEmail(email, name, userType) {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || "Agri-Noria"}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Welcome to Agri-Noria! 🎉",
        html: generateWelcomeEmailTemplate(name, userType),
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log("Welcome email sent successfully:", result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error("Error sending welcome email:", error);
      return { success: false, error: error.message };
    }
  }

  // Send buyer order confirmation email
  async sendBuyerOrderConfirmationEmail(buyerEmail, buyerName, orderData) {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || "Agri-Noria"}" <${process.env.EMAIL_USER}>`,
        to: buyerEmail,
        subject: "Order Confirmation - Your Purchase is Confirmed",
        html: generateBuyerOrderConfirmationTemplate({
          buyerName,
          orderNumber: orderData.id,
          totalAmount: orderData.total_amount,
          currency: orderData.currency || "NGN",
          items: orderData.items || [],
        }),
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(
        "Buyer order confirmation email sent successfully:",
        result.messageId,
      );
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(
        "Error sending buyer order confirmation email:",
        error.message,
      );
      return { success: false, error: error.message };
    }
  }

  // Send vendor (seller) new order notification email
  async sendVendorNewOrderEmail(vendorEmail, vendorName, orderData) {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || "Agri-Noria"}" <${process.env.EMAIL_USER}>`,
        to: vendorEmail,
        subject: "New Order Received - Payment Confirmed",
        html: generateVendorNewOrderTemplate({
          vendorName,
          orderNumber: orderData.id,
          buyerName: orderData.buyer_name,
          totalAmount: orderData.subtotal,
          currency: orderData.currency,
        }),
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(
        "Vendor new order email sent successfully:",
        result.messageId,
      );
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error("Error sending vendor new order email:", error.message);
      return { success: false, error: error.message };
    }
  }

  // Send logistics partner assignment email
  async sendLogisticsAssignmentEmail(logisticsEmail, logisticsName, orderData) {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || "Agri-Noria"}" <${process.env.EMAIL_USER}>`,
        to: logisticsEmail,
        subject: "New Delivery Assignment - Action Required",
        html: generateLogisticsAssignmentTemplate({
          logisticsName,
          orderNumber: orderData.id,
          pickupAddress: orderData.pickup_address || "Awaiting details",
          deliveryAddress: orderData.delivery_address || "Awaiting details",
        }),
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(
        "Logistics assignment email sent successfully:",
        result.messageId,
      );
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error("Error sending logistics assignment email:", error.message);
      return { success: false, error: error.message };
    }
  }

  // Send shipment start email to buyer. Used inside logisticsOperationController file
  async sendShipmentStartEmail(buyerEmail, shipmentData) {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || "Agri-Noria"}" <${process.env.EMAIL_USER}>`,
        to: buyerEmail,
        subject: `Your Shipment Has Started - ${shipmentData.tracking_number}`,
        html: generateShipmentStartTemplate({
          buyerName: shipmentData.buyer_name,
          orderNumber: shipmentData.order_number,
          trackingNumber: shipmentData.tracking_number,
          driverName: shipmentData.driver_name,
          driverPhone: shipmentData.driver_phone,
          vehiclePlate: shipmentData.vehicle_plate,
          estimatedDelivery: shipmentData.estimated_delivery,
          deliveryOTP: shipmentData.delivery_otp,
          shipmentStartedAt: shipmentData.shipment_started_at,
          deliveryAddress: shipmentData.delivery_address,
        }),
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log("Shipment start email sent successfully:", result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error("Error sending shipment start email:", error.message);
      return { success: false, error: error.message };
    }
  }

  // Send all three emails for order notification (buyer, seller, logistics) used inside payment controller file
  async sendOrderNotificationEmails(emailData) {
    try {
      const results = {
        buyer: null,
        seller: null,
        logistics: null,
      };

      // Send buyer order confirmation
      if (emailData.buyer?.email && emailData.buyer?.name) {
        results.buyer = await this.sendBuyerOrderConfirmationEmail(
          emailData.buyer.email,
          emailData.buyer.name,
          emailData.order,
        );
      }

      // Send vendor (seller) new order notification
      if (emailData.seller?.email && emailData.seller?.fname) {
        const sellerName =
          `${emailData.seller.fname} ${emailData.seller.lname || ""}`.trim();
        results.seller = await this.sendVendorNewOrderEmail(
          emailData.seller.email,
          sellerName,
          {
            ...emailData.order,
            buyer_name: emailData.buyer?.name,
          },
        );
      }

      // Send logistics partner assignment email
      if (emailData.logistics?.email && emailData.logistics?.fname) {
        const logisticsName =
          `${emailData.logistics.fname} ${emailData.logistics.lname || ""}`.trim();
        results.logistics = await this.sendLogisticsAssignmentEmail(
          emailData.logistics.email,
          logisticsName,
          emailData.order,
        );
      }

      return {
        success: true,
        results,
        message: "Order notification emails sent successfully",
      };
    } catch (error) {
      console.error("Error sending order notification emails:", error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new EmailService();
