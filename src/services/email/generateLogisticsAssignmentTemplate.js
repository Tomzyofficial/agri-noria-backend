export const generateLogisticsAssignmentTemplate = ({
  logisticsName,
  orderNumber,
  pickupAddress,
  deliveryAddress,
}) => {
  return `
   <!DOCTYPE html>
   <html>
   <body style="
      font-family:Arial;
      background:#f5f5f5;
      padding:20px;
   ">

      <div style="
         max-width:600px;
         margin:auto;
         background:white;
         padding:30px;
         border-radius:10px;
      ">

         <h2 style="color:#16a34a;">
            New Delivery Assignment
         </h2>

         <p>Hello ${logisticsName},</p>

         <p>
            A new shipment has been assigned to your logistics team.
         </p>

         <div style="
            background:#f0fdf4;
            padding:15px;
            border-radius:8px;
            margin:20px 0;
         ">
            <p><strong>Order Number:</strong> ${orderNumber}</p>

            <p><strong>Pickup Address:</strong><br/>
            ${pickupAddress}</p>

            <p><strong>Delivery Address:</strong><br/>
            ${deliveryAddress}</p>
         </div>

         <p>
            Please log into your dashboard to accept or decline this assignment.
         </p>

      </div>

   </body>
   </html>
   `;
};
