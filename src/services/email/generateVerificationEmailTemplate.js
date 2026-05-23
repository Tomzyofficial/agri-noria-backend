export const generateVerificationEmailTemplate = (verificationCode) => {
  // const userTypeName = userType === "vendor" ? "Vendor" : "Buyer";

  return `
         <!DOCTYPE html>
         <html lang="en">
         <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification - Agri-Connect</title>
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
               .verification-code {
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  font-size: 32px;
                  font-weight: bold;
                  letter-spacing: 8px;
                  padding: 20px;
                  text-align: center;
                  border-radius: 10px;
                  margin: 30px 0;
                  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
               }
               .info {
                  background-color: #f0fdf4;
                  border-left: 4px solid #10b981;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 0 5px 5px 0;
               }
               .footer {
                  text-align: center;
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                  font-size: 14px;
               }
               .btn {
                  display: inline-block;
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  padding: 12px 30px;
                  text-decoration: none;
                  border-radius: 25px;
                  font-weight: 600;
                  margin: 20px 0;
                  transition: transform 0.2s;
               }
               .btn:hover {
                  transform: translateY(-2px);
               }
            </style>
         </head>
         <body>
            <div class="container">
               <div class="header">
                  <div class="logo">🌱 Agri-Connect</div>
                  <h2>Email Verification Required</h2>
               </div>

               <p>Hello!</p>
               
               <p>Thank you for your interest in our platform! To complete your registration and secure your account, please verify your email address.</p>

               <div class="verification-code">
                  ${verificationCode}
               </div>

               <div class="info">
                  <strong>Important:</strong> This verification code will expire in <strong>15 minutes</strong>. Please use it promptly to complete your registration.
               </div>

               <p><strong>Steps to verify:</strong></p>
               <ol>
                  <li>Copy the verification code above</li>
                  <li>Return to the registration page</li>
                  <li>Click on the Next button</li>
                  <li>Enter the code in the verification field</li>
                  <li>Click "Verify Email" to complete registration</li>
               </ol>

               <p>If you didn't request this verification, please ignore this email. Your account will not be created without email verification.</p>

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
};
