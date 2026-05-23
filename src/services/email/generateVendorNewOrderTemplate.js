export const generateVendorNewOrderTemplate = ({
  vendorName,
  orderNumber,
  buyerName,
  totalAmount,
  currency,
}) => {
  return `
   <!DOCTYPE html>
   <html>
   <body style="font-family:Arial;background:#f5f5f5;padding:20px;">

      <div style="
         max-width:600px;
         margin:auto;
         background:white;
         padding:30px;
         border-radius:10px;
      ">

         <h2 style="color:#16a34a;">
            New Paid Order Received
         </h2>

         <p>Hello ${vendorName},</p>

         <p>
            A buyer has successfully paid for an order.
         </p>

         <div style="
            background:#f0fdf4;
            padding:15px;
            border-radius:8px;
            margin:20px 0;
         ">
            <p><strong>Order Number:</strong> ${orderNumber}</p>

            <p><strong>Buyer:</strong> ${buyerName}</p>

            <p><strong>Total:</strong> ${currency} ${totalAmount}</p>

            <p><strong>Status:</strong> Awaiting Fulfillment</p>
         </div>

         <p>
            Please visit your dashboard to see more details about this order. Prepare the order for logistics pickup or shipment.
         </p>

         <p>
            Funds are currently held securely in escrow until delivery confirmation.
         </p>

      </div>

   </body>
   </html>
   `;
};
