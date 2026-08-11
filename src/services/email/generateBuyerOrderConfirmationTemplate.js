export const generateBuyerOrderConfirmationTemplate = ({
  buyerName,
  orderNumber,
  totalAmount,
  currency,
  items,
}) => {
  return `
   <!DOCTYPE html>
   <html>
   <head>
      <style>
         body{
            font-family: Arial, sans-serif;
            background:#f5f5f5;
            padding:20px;
         }

         .container{
            max-width:600px;
            margin:auto;
            background:white;
            padding:30px;
            border-radius:10px;
         }

         .header{
            text-align:center;
            color:#16a34a;
         }

         .summary{
            background:#f0fdf4;
            padding:15px;
            border-radius:8px;
            margin:20px 0;
         }

         table{
            width:100%;
            border-collapse:collapse;
         }

         td,th{
            padding:10px;
            border-bottom:1px solid #ddd;
         }

         .footer{
            margin-top:30px;
            font-size:13px;
            color:#777;
         }
      </style>
   </head>

   <body>
      <div class="container">

         <div class="header">
            <h1>Payment Successful</h1>
            <p>Your order has been received successfully.</p>
         </div>

         <p>Hello ${buyerName},</p>

         <p>
            Thank you for placing an order on Agri-Noria.
            Your payment has been verified successfully.
         </p>

         <div class="summary">
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Total Amount:</strong> ${currency} ${totalAmount}</p>
            <p><strong>Status:</strong> Payment Verified</p>
         </div>

         <h3>Order Items</h3>

         <table>
            <thead>
               <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
               </tr>
            </thead>

            <tbody>
               ${items
                 .map(
                   (item) => `
                  <tr>
                     <td>${item.listing_name}</td>
                     <td>${item.quantity}</td>
                     <td>${currency} ${item.price}</td>
                  </tr>
               `,
                 )
                 .join("")}
            </tbody>
         </table>

          <p><strong>Total Amount:</strong> ${currency} ${totalAmount}</p>

         <p style="margin-top:20px;">
            The vendor is now preparing your order for shipment.
         </p>

         <div class="footer">
            <p>
               This is an automated message from Agri-Noria.
            </p>
         </div>

      </div>
   </body>
   </html>
   `;
};
