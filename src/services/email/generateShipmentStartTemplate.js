/**
 * Generate HTML email template for shipment start notification
 * @param {Object} data - Shipment data
 * @param {string} data.buyerName - Buyer's name
 * @param {string} data.orderNumber - Order number/ID
 * @param {string} data.trackingNumber - Tracking number
 * @param {string} data.driverName - Assigned driver name
 * @param {string} data.driverPhone - Driver phone number
 * @param {string} data.vehiclePlate - Vehicle plate number
 * @param {string} data.estimatedDelivery - Estimated delivery date/time
 * @param {string} data.deliveryOTP - Delivery OTP
 * @param {string} data.shipmentStartedAt - Shipment start timestamp
 * @param {string} data.deliveryAddress - Delivery address
 * @returns {string} HTML email template
 */
export function generateShipmentStartTemplate({
  buyerName,
  orderNumber,
  trackingNumber,
  driverName,
  driverPhone,
  vehiclePlate,
  estimatedDelivery,
  deliveryOTP,
  shipmentStartedAt,
  deliveryAddress,
}) {
  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Shipment Has Started - Agri-Noria</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #2d5016 0%, #4a7c23 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .header p {
      margin: 10px 0 0;
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 30px;
    }
    .welcome {
      font-size: 18px;
      margin-bottom: 20px;
    }
    .tracking-box {
      background-color: #f8f9fa;
      border: 2px solid #4a7c23;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 25px 0;
    }
    .tracking-number {
      font-size: 24px;
      font-weight: bold;
      color: #2d5016;
      letter-spacing: 2px;
      margin: 10px 0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 25px 0;
    }
    .info-item {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #4a7c23;
    }
    .info-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .info-value {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    .otp-box {
      background: linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%);
      border: 2px solid #ffc107;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 25px 0;
    }
    .otp-label {
      font-size: 14px;
      color: #856404;
      margin-bottom: 10px;
    }
    .otp-code {
      font-size: 32px;
      font-weight: bold;
      color: #856404;
      letter-spacing: 5px;
      margin: 10px 0;
    }
    .otp-warning {
      font-size: 12px;
      color: #856404;
      margin-top: 10px;
    }
    .timeline {
      margin: 25px 0;
    }
    .timeline-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 15px;
    }
    .timeline-icon {
      background-color: #4a7c23;
      color: white;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 15px;
      flex-shrink: 0;
      font-weight: bold;
    }
    .timeline-content {
      flex: 1;
    }
    .timeline-title {
      font-weight: 600;
      color: #333;
    }
    .timeline-time {
      font-size: 12px;
      color: #666;
    }
    .support-section {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 6px;
      margin: 25px 0;
    }
    .support-section h3 {
      margin: 0 0 10px;
      color: #2d5016;
    }
    .support-section p {
      margin: 5px 0;
      font-size: 14px;
    }
    .footer {
      background-color: #2d5016;
      color: white;
      text-align: center;
      padding: 20px;
      border-radius: 0 0 8px 8px;
      font-size: 14px;
    }
    .footer a {
      color: #fff;
      text-decoration: underline;
    }
    @media only screen and (max-width: 600px) {
      .info-grid {
        grid-template-columns: 1fr;
      }
      .tracking-number {
        font-size: 20px;
      }
      .otp-code {
        font-size: 28px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚚 Your Shipment Has Started!</h1>
      <p>Your order is now on its way</p>
    </div>
    
    <div class="content">
      <p class="welcome">
        Dear ${buyerName || 'Valued Customer'},
      </p>
      <p>
        Great news! Your order <strong>#${orderNumber}</strong> has been picked up and is now in transit. 
        Your shipment is being handled by our trusted logistics partner.
      </p>
      
      <div class="tracking-box">
        <div class="info-label">TRACKING NUMBER</div>
        <div class="tracking-number">${trackingNumber}</div>
        <p style="margin: 10px 0 0; font-size: 14px; color: #666;">
          Use this number to track your shipment or contact support
        </p>
      </div>
      
      <h3 style="color: #2d5016; margin: 25px 0 15px;">📋 Shipment Details</h3>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Driver Name</div>
          <div class="info-value">${driverName || 'Assigned Driver'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Driver Phone</div>
          <div class="info-value">${driverPhone || 'Contact Logistics'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Vehicle Plate</div>
          <div class="info-value">${vehiclePlate || 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Estimated Delivery</div>
          <div class="info-value">${formatDate(estimatedDelivery)}</div>
        </div>
      </div>
      
      <div class="otp-box">
        <div class="otp-label">🔐 DELIVERY OTP (ONE-TIME PASSWORD)</div>
        <div class="otp-code">${deliveryOTP}</div>
        <p class="otp-warning">
          <strong>Important:</strong> Please provide this OTP to the driver upon delivery. 
          Do not share this code with anyone else.
        </p>
      </div>
      
      <h3 style="color: #2d5016; margin: 25px 0 15px;">📍 Delivery Address</h3>
      <p style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 0;">
        ${deliveryAddress || 'Address not specified'}
      </p>
      
      <div class="timeline">
        <h3 style="color: #2d5016; margin: 25px 0 15px;">📅 Shipment Timeline</h3>
        
        <div class="timeline-item">
          <div class="timeline-icon">✓</div>
          <div class="timeline-content">
            <div class="timeline-title">Shipment Started</div>
            <div class="timeline-time">${formatDate(shipmentStartedAt)}</div>
          </div>
        </div>
        
        <div class="timeline-item">
          <div class="timeline-icon">→</div>
          <div class="timeline-content">
            <div class="timeline-title">In Transit</div>
            <div class="timeline-time">Your package is on the way</div>
          </div>
        </div>
        
        <div class="timeline-item">
          <div class="timeline-icon">📦</div>
          <div class="timeline-content">
            <div class="timeline-title">Estimated Delivery</div>
            <div class="timeline-time">${formatDate(estimatedDelivery)}</div>
          </div>
        </div>
      </div>
      
      <div class="support-section">
        <h3>📞 Need Help?</h3>
        <p>
          If you have any questions or concerns about your shipment, please contact our support team:
        </p>
        <p>
          <strong>Email:</strong> support@agri-noria.com<br>
          <strong>Phone:</strong> +234 XXX XXX XXXX<br>
          <strong>Tracking Number:</strong> ${trackingNumber}
        </p>
        <p style="margin-top: 10px; font-size: 13px; color: #666;">
          Please have your tracking number ready when contacting support.
        </p>
      </div>
      
      <p style="margin: 25px 0; font-size: 14px; color: #666;">
        Thank you for choosing Agri-Noria. We appreciate your business!
      </p>
    </div>
    
    <div class="footer">
      <p>© 2024 Agri-Noria. All rights reserved.</p>
      <p>
        <a href="#">Privacy Policy</a> | 
        <a href="#">Terms of Service</a> | 
        <a href="#">Contact Us</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
