export function generateWelcomeEmailTemplate(name, userType) {
  const userTypeName = userType ? userType : "Buyer";
  const dashboardUrl = userType
    ? `${process.env.FRONTEND_APP_URL || "http://localhost:3000"}/dashboard`
    : `${process.env.FRONTEND_APP_URL || "http://localhost:3000"}/dashboard/buyer`;

  return `
         <!DOCTYPE html>
         <html lang="en">
         <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Agri-Connect!</title>
            <style>
               body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #f4f4f4;
               }
               .container {
                  background-color: #ffffff;
                  padding: 30px;
                  border-radius: 10px;
                  box-shadow: 0 0 20px rgba(0,0,0,0.1);
               }
               .header {
                  text-align: center;
                  margin-bottom: 30px;
               }
               .logo {
                  color: #10b981;
                  font-size: 28px;
                  font-weight: bold;
                  margin-bottom: 10px;
               }
               .welcome {
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  padding: 30px;
                  text-align: center;
                  border-radius: 10px;
                  margin: 30px 0;
               }
               .btn {
                  display: inline-block;
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  padding: 15px 35px;
                  text-decoration: none;
                  border-radius: 25px;
                  font-weight: 600;
                  margin: 20px 0;
                  transition: transform 0.2s;
               }
               .btn:hover {
                  transform: translateY(-2px);
               }
               .features {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 20px;
                  margin: 30px 0;
               }
               .feature {
                  background-color: #f0fdf4;
                  padding: 20px;
                  border-radius: 8px;
                  border-left: 4px solid #10b981;
               }
               .footer {
                  text-align: center;
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                  font-size: 14px;
               }
            </style>
         </head>
         <body>
            <div class="container">
               <div class="header">
                  <div class="logo">🌱 Agri-Noria</div>
               </div>

               <div class="welcome">
                  <h2>🎉 Welcome to Agri-Noria!</h2>
                  <p>Your email has been verified successfully</p>
               </div>

               <p>Hello <strong>${name}</strong>,</p>
               
               <p>Congratulations! Your ${userTypeName} account has been successfully created and verified. You're now ready to join our thriving agricultural community.</p>

               <div class="features">
                  <div class="feature">
                     <h4>🛍️ Marketplace</h4>
                     <p>Buy and sell agricultural products directly</p>
                  </div>
                  <div class="feature">
                     <h4>🚚 Logistics</h4>
                     <p>Connect with reliable transport services</p>
                  </div>
                  <div class="feature">
                     <h4>🏪 Storage</h4>
                     <p>Find secure storage facilities</p>
                  </div>
                  <div class="feature">
                     <h4>📚 Training</h4>
                     <p>Learn from agricultural experts</p>
                  </div>
               </div>

               <div style="text-align: center;">
                  <a href="${dashboardUrl}" class="btn">Go to Dashboard</a>
               </div>

               <p>Need help? Our support team is here to assist you at <a href="mailto:support@agri-noria.com">support@agri-noria.com</a></p>

               <div class="footer">
                  <p>Best regards,<br>The Agri-Noria Team</p>
                  <p style="font-size: 12px; margin-top: 20px;">
                     This is an automated message. Please do not reply to this email.
                  </p>
               </div>
            </div>
         </body>
         </html>
      `;
}
